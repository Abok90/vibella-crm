'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface UserPermissions {
  perm_dashboard: boolean
  perm_orders: boolean
  perm_accounting: boolean
  perm_inventory: boolean
  perm_customers: boolean
  perm_settings: boolean
  perm_can_delete: boolean
  perm_can_export: boolean
  perm_can_create: boolean
  perm_can_edit: boolean
}

export interface UserWithPermissions {
  id: string
  full_name: string
  email: string
  role: string
  is_approved: boolean
  is_active: boolean
  avatar_url?: string
  phone?: string
  created_at: string
  approved_at?: string
  rejected_at?: string
  approver_name?: string
  permissions?: UserPermissions
}

// ────────────────────────────────────────────────────────────
// Guard: only admin can perform these actions
// ────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('غير مصرح')

  const isHardcodedAdmin = user.email?.toLowerCase() === 'ahmedsayed328@gmail.com'
  if (!isHardcodedAdmin) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin') throw new Error('ليس لديك صلاحية للوصول')
  }

  return user.id
}

// ────────────────────────────────────────────────────────────
// GET: Pending Users (awaiting approval)
// ────────────────────────────────────────────────────────────

export async function getPendingUsers(): Promise<UserWithPermissions[]> {
  await requireAdmin()
  const admin = createAdminClient()

  // Get unapproved profiles (exclude rejected ones)
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, role, is_approved, is_active, created_at, rejected_at')
    .eq('is_approved', false)
    .is('rejected_at', null)
    .order('created_at', { ascending: false })

  if (error || !profiles) return []

  // Get emails from auth.users via admin API
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authUsers?.users?.map(u => [u.id, u.email]) ?? [])

  return profiles.map(p => ({
    ...p,
    email: emailMap.get(p.id) ?? '',
    permissions: undefined,
  }))
}

// ────────────────────────────────────────────────────────────
// GET: All Active Users with Permissions
// ────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<UserWithPermissions[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: profiles, error } = await admin
    .from('profiles')
    .select(`
      id, full_name, role, is_approved, is_active, created_at, approved_at,
      approver:approved_by ( full_name ),
      permissions:user_permissions (
        perm_dashboard, perm_orders, perm_accounting, perm_inventory,
        perm_customers, perm_settings, perm_can_delete, perm_can_export,
        perm_can_create, perm_can_edit
      )
    `)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })

  if (error || !profiles) return []

  // Get emails
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authUsers?.users?.map(u => [u.id, u.email]) ?? [])

  return profiles.map((p: any) => ({
    ...p,
    email: emailMap.get(p.id) ?? '',
    approver_name: p.approver?.full_name,
    permissions: Array.isArray(p.permissions) ? p.permissions[0] : p.permissions,
  }))
}

// ────────────────────────────────────────────────────────────
// GET: Suspended Users
// ────────────────────────────────────────────────────────────

export async function getSuspendedUsers(): Promise<UserWithPermissions[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, role, is_approved, is_active, created_at')
    .eq('is_approved', true)
    .eq('is_active', false)
    .order('created_at', { ascending: false })

  if (error || !profiles) return []

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map(authUsers?.users?.map(u => [u.id, u.email]) ?? [])

  return profiles.map(p => ({
    ...p,
    email: emailMap.get(p.id) ?? '',
  }))
}

// ────────────────────────────────────────────────────────────
// ACTION: Approve User + Set Permissions
// ────────────────────────────────────────────────────────────

export async function approveUser(
  userId: string,
  permissions: UserPermissions
): Promise<{ success: boolean; error?: string }> {
  try {
    const approverId = await requireAdmin()
    const admin = createAdminClient()

    const { error } = await admin.rpc('approve_user', {
      p_user_id: userId,
      p_approver_id: approverId,
      p_permissions: permissions,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ────────────────────────────────────────────────────────────
// ACTION: Reject User (soft delete — marks rejected_at)
// ────────────────────────────────────────────────────────────

export async function rejectUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()

    // Optionally delete from auth entirely, or just mark rejected
    const { error } = await admin
      .from('profiles')
      .update({ rejected_at: new Date().toISOString(), is_active: false })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ────────────────────────────────────────────────────────────
// ACTION: Update Permissions for Existing User
// ────────────────────────────────────────────────────────────

export async function updateUserPermissions(
  userId: string,
  permissions: UserPermissions
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()

    const { error } = await admin
      .from('user_permissions')
      .upsert({ user_id: userId, ...permissions, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ────────────────────────────────────────────────────────────
// ACTION: Suspend / Reinstate User
// ────────────────────────────────────────────────────────────

export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()

    const { error } = await admin
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ────────────────────────────────────────────────────────────
// ACTION: Delete User Permanently (from Auth + DB)
// ────────────────────────────────────────────────────────────

export async function deleteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const admin = createAdminClient()

    // Delete from auth (cascades to profile via FK)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ────────────────────────────────────────────────────────────
// GET: Current User Permissions (for nav protection)
// ────────────────────────────────────────────────────────────

export async function getCurrentUserPermissions(): Promise<UserPermissions | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Admin always has all permissions
  if (user.email?.toLowerCase() === 'ahmedsayed328@gmail.com') {
    return {
      perm_dashboard: true, perm_orders: true, perm_accounting: true,
      perm_inventory: true, perm_customers: true, perm_settings: true,
      perm_can_delete: true, perm_can_export: true, perm_can_create: true,
      perm_can_edit: true,
    }
  }

  const { data } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return data as UserPermissions | null
}
