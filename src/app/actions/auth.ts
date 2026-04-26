'use server'

import { createClient } from '@/lib/supabase/server'
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
    return { error: error.message }
  }

  // ✅ Check if user is approved before allowing access
  if (data.user) {
    const isHardcodedAdmin = data.user.email?.toLowerCase() === 'ahmedsayed328@gmail.com'

    if (!isHardcodedAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved, is_active')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        // Profile doesn't exist yet (edge case: trigger may have failed)
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
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return { error: 'هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.' }
    }
    if (error.message.includes('valid email')) {
      return { error: 'يرجى إدخال بريد إلكتروني صحيح' }
    }
    if (error.message.includes('at least')) {
      return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
    }
    return { error: error.message }
  }

  // ✅ Detect Supabase "fake user" — email already registered
  // When email exists, Supabase returns a user with empty identities array
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'هذا البريد الإلكتروني مسجل بالفعل. جرّب تسجيل الدخول.' }
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
