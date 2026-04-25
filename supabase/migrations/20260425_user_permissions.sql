-- =====================================================
-- User Permissions & Approval System
-- Run this in Supabase SQL Editor (as a migration)
-- =====================================================

-- 1. Add approval fields to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update existing users to be approved (they were created before this system)
-- Admin (ahmedsayed328@gmail.com) stays approved
UPDATE profiles SET is_approved = true WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'ahmedsayed328@gmail.com'
);

-- 2. Create granular permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Page Access
  perm_dashboard    BOOLEAN DEFAULT true,
  perm_orders       BOOLEAN DEFAULT false,
  perm_accounting   BOOLEAN DEFAULT false,
  perm_inventory    BOOLEAN DEFAULT false,
  perm_customers    BOOLEAN DEFAULT false,
  perm_settings     BOOLEAN DEFAULT false,
  -- Action Permissions
  perm_can_delete   BOOLEAN DEFAULT false,
  perm_can_export   BOOLEAN DEFAULT false,
  perm_can_create   BOOLEAN DEFAULT true,
  perm_can_edit     BOOLEAN DEFAULT true,
  -- Created / Updated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger: auto-create profile + permissions when new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Create profile (unapproved by default)
  INSERT INTO profiles (id, full_name, role, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'moderator',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create empty permissions row
  INSERT INTO user_permissions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Function: Approve user and set permissions atomically
CREATE OR REPLACE FUNCTION approve_user(
  p_user_id UUID,
  p_approver_id UUID,
  p_permissions JSONB
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Update profile: mark as approved
  UPDATE profiles
  SET 
    is_approved = true,
    approved_by = p_approver_id,
    approved_at = NOW(),
    rejected_at = NULL
  WHERE id = p_user_id;

  -- Upsert permissions
  INSERT INTO user_permissions (
    user_id,
    perm_dashboard,
    perm_orders,
    perm_accounting,
    perm_inventory,
    perm_customers,
    perm_settings,
    perm_can_delete,
    perm_can_export,
    perm_can_create,
    perm_can_edit,
    updated_at
  ) VALUES (
    p_user_id,
    COALESCE((p_permissions->>'perm_dashboard')::boolean, true),
    COALESCE((p_permissions->>'perm_orders')::boolean, false),
    COALESCE((p_permissions->>'perm_accounting')::boolean, false),
    COALESCE((p_permissions->>'perm_inventory')::boolean, false),
    COALESCE((p_permissions->>'perm_customers')::boolean, false),
    COALESCE((p_permissions->>'perm_settings')::boolean, false),
    COALESCE((p_permissions->>'perm_can_delete')::boolean, false),
    COALESCE((p_permissions->>'perm_can_export')::boolean, false),
    COALESCE((p_permissions->>'perm_can_create')::boolean, true),
    COALESCE((p_permissions->>'perm_can_edit')::boolean, true),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    perm_dashboard    = EXCLUDED.perm_dashboard,
    perm_orders       = EXCLUDED.perm_orders,
    perm_accounting   = EXCLUDED.perm_accounting,
    perm_inventory    = EXCLUDED.perm_inventory,
    perm_customers    = EXCLUDED.perm_customers,
    perm_settings     = EXCLUDED.perm_settings,
    perm_can_delete   = EXCLUDED.perm_can_delete,
    perm_can_export   = EXCLUDED.perm_can_export,
    perm_can_create   = EXCLUDED.perm_can_create,
    perm_can_edit     = EXCLUDED.perm_can_edit,
    updated_at        = NOW();
END;
$$;

-- 5. RLS Policies

-- Profiles: users can read own profile, admin can read all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'ahmedsayed328@gmail.com'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- User permissions: users can read own, admin can do all
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_select_own" ON user_permissions;
CREATE POLICY "permissions_select_own" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "permissions_admin_all" ON user_permissions;
CREATE POLICY "permissions_admin_all" ON user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'ahmedsayed328@gmail.com'
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- 6. Ensure existing profiles have a permissions row
INSERT INTO user_permissions (user_id, perm_dashboard, perm_orders, perm_accounting, perm_inventory, perm_customers)
SELECT id, true, true, true, true, true
FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_permissions)
ON CONFLICT (user_id) DO NOTHING;

-- Grant existing approved users full access
UPDATE user_permissions up
SET 
  perm_dashboard = true,
  perm_orders = true,
  perm_accounting = true,
  perm_inventory = true,
  perm_customers = true,
  perm_can_create = true,
  perm_can_edit = true
FROM profiles p
WHERE up.user_id = p.id AND p.is_approved = true;
