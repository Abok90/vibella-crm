'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ────────────────────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'بيانات الدخول غير صحيحة' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'يرجى تأكيد بريدك الإلكتروني أولاً' }
    }
    if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
      return { error: 'تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.' }
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return { error: 'خطأ في الاتصال بالإنترنت. تحقق من اتصالك وحاول مجدداً.' }
    }
    return { error: error.message }
  }

  // ✅ Check if user is approved before allowing access
  // NOTE: Using admin client here because RLS auth.uid() isn't available yet
  // in the same server action right after signInWithPassword() — cookies
  // haven't been committed to the response yet.
  if (data.user) {
    const isHardcodedAdmin = data.user.email?.toLowerCase() === 'ahmedsayed328@gmail.com'

    if (!isHardcodedAdmin) {
      const admin = createAdminClient()
      const { data: profile } = await admin
        .from('profiles')
        .select('is_approved, is_active')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        await supabase.auth.signOut()
        return { error: 'حدث خطأ في إعداد الحساب. تواصل مع المدير.' }
      }

      if (!profile.is_approved) {
        await supabase.auth.signOut()
        return { error: 'حسابك في انتظار موافقة المدير. سيتم إعلامك عند التفعيل.' }
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut()
        return { error: 'تم إيقاف حسابك. تواصل مع المدير للمزيد من المعلومات.' }
      }
    }
  }

  // ✅ Update last_seen_at for online tracking
  if (data.user) {
    const admin = createAdminClient()
    await admin
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', data.user.id)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

// ────────────────────────────────────────────────────────────
// SIGNUP
// ────────────────────────────────────────────────────────────

export async function signupAction(formData: FormData) {
  const fullName = formData.get('full_name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  // ── Validation ──
  if (!fullName || !fullName.trim()) {
    return { error: 'يرجى إدخال الاسم الكامل' }
  }

  if (!email || !password) {
    return { error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }
  }

  if (password.length < 6) {
    return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }

  if (password !== confirmPassword) {
    return { error: 'كلمة المرور وتأكيدها غير متطابقتين' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  })

  if (error) {
    // Handle common Supabase errors with Arabic messages
    if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
      return { error: 'تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.' }
    }
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return { error: 'هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.' }
    }
    if (error.message.includes('valid email')) {
      return { error: 'يرجى إدخال بريد إلكتروني صحيح' }
    }
    if (error.message.includes('at least')) {
      return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return { error: 'خطأ في الاتصال بالإنترنت. تحقق من اتصالك وحاول مجدداً.' }
    }
    return { error: error.message }
  }

  // ✅ Detect Supabase "fake user" — email already registered
  // When email exists, Supabase returns a user with empty identities array
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.' }
  }

  // ✅ Fallback: ensure profile + permissions exist even if DB trigger failed
  if (data.user) {
    try {
      const admin = createAdminClient()

      // Insert profile (skip if trigger already created it)
      await admin.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        role: 'moderator',
        is_approved: false,
        is_active: true,
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Insert permissions row
      await admin.from('user_permissions').upsert({
        user_id: data.user.id,
      }, { onConflict: 'user_id', ignoreDuplicates: true })
    } catch {
      // Non-critical — trigger may have already handled it
      console.warn('Fallback profile insert skipped or failed')
    }
  }

  // ✅ Don't redirect — user needs admin approval first
  // Sign out immediately so they can't access the app
  await supabase.auth.signOut()

  return {
    success: true,
    message: 'تم إنشاء حسابك بنجاح ✅\nحسابك في انتظار موافقة المدير. سيتم إعلامك عند التفعيل.',
  }
}

// ────────────────────────────────────────────────────────────
// LOGOUT
// ────────────────────────────────────────────────────────────

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/ar/login')
}
