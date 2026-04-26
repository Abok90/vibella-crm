'use client'

import { useState } from 'react'
import { loginAction, signupAction } from '@/app/actions/auth'
import { cn } from '@/lib/utils'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccessMessage('')

    const formData = new FormData(e.currentTarget)

    // Client-side validation for signup
    if (!isLogin) {
      const fullName = formData.get('full_name') as string
      const password = formData.get('password') as string
      const confirmPassword = formData.get('confirm_password') as string

      if (!fullName || !fullName.trim()) {
        setError('يرجى إدخال الاسم الكامل')
        setIsLoading(false)
        return
      }

      if (password.length < 6) {
        setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
        setIsLoading(false)
        return
      }

      if (password !== confirmPassword) {
        setError('كلمة المرور وتأكيدها غير متطابقتين')
        setIsLoading(false)
        return
      }
    }

    try {
      const result = isLogin
        ? await loginAction(formData)
        : await signupAction(formData)

      if (result && 'error' in result && result.error) {
        setError(result.error)
      } else if (result && 'success' in result && result.success) {
        // Signup success — show approval pending message
        setSuccessMessage(result.message || 'تم إنشاء الحساب بنجاح')
        // Switch back to login tab after signup success
        setIsLogin(true)
      }
    } catch {
      // redirect() in Next.js throws a special error — don't treat it as a user error
      // In Next.js 16, successful redirect will throw, which is expected behavior
    } finally {
      setIsLoading(false)
    }
  }

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin)
    setError('')
    setSuccessMessage('')
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 gap-6" dir="rtl">
      {/* ── Logo & Title ── */}
      <div className="flex flex-col items-center justify-center mb-2">
        <div className="w-16 h-16 rounded-[18px] gradient-primary flex items-center justify-center mb-3 shadow-lg glow-primary">
          <span className="text-white text-2xl font-bold">V</span>
        </div>
        <h1 className="ios-large-title text-foreground">Vibella CRM</h1>
        <p className="ios-subheadline text-muted-foreground mt-0.5">نظام إدارة المبيعات</p>
      </div>

      <div className="w-full max-w-[360px] space-y-3">
        {/* ── Success Message ── */}
        {successMessage && (
          <div className="bg-[#22C55E]/10 text-[#22C55E] rounded-[14px] px-4 py-3 text-center space-y-2 animate-in fade-in duration-300">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-1" />
            {successMessage.split('\n').map((line, i) => (
              <p key={i} className={cn("ios-footnote font-semibold", i === 0 && "ios-body")}>{line}</p>
            ))}
          </div>
        )}

        {/* ── Tab Switcher ── */}
        <div className="flex gap-0.5 p-0.5 bg-accent/60 rounded-[9px]">
          <button
            type="button"
            onClick={() => switchTab(true)}
            className={cn("flex-1 py-1.5 text-[13px] font-semibold rounded-[7px] transition-all",
              isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            تسجيل دخول
          </button>
          <button
            type="button"
            onClick={() => switchTab(false)}
            className={cn("flex-1 py-1.5 text-[13px] font-semibold rounded-[7px] transition-all",
              !isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            إنشاء حساب
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Error Alert */}
          {error && (
            <div className="bg-[#FF3B30]/10 text-[#FF3B30] rounded-[10px] px-3 py-2 ios-footnote text-center font-semibold animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <div className="bg-card rounded-[14px] overflow-hidden">
            {/* Full Name — signup only */}
            {!isLogin && (
              <div className="px-4 py-3 border-b border-border">
                <label className="ios-caption text-muted-foreground block mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  name="full_name"
                  required={!isLogin}
                  autoComplete="name"
                  className="w-full bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                  placeholder="مثال: أحمد محمد"
                />
              </div>
            )}

            {/* Email */}
            <div className="px-4 py-3 border-b border-border">
              <label className="ios-caption text-muted-foreground block mb-1">البريد الإلكتروني</label>
              <input
                dir="ltr"
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                placeholder="name@company.com"
              />
            </div>

            {/* Password */}
            <div className={cn("px-4 py-3", !isLogin && "border-b border-border")}>
              <label className="ios-caption text-muted-foreground block mb-1">كلمة المرور</label>
              <div className="flex items-center gap-2">
                <input
                  dir="ltr"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="flex-1 bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="ios-caption text-muted-foreground mt-1">6 أحرف على الأقل</p>
              )}
            </div>

            {/* Confirm Password — signup only */}
            {!isLogin && (
              <div className="px-4 py-3">
                <label className="ios-caption text-muted-foreground block mb-1">تأكيد كلمة المرور</label>
                <div className="flex items-center gap-2">
                  <input
                    dir="ltr"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    required={!isLogin}
                    minLength={6}
                    autoComplete="new-password"
                    className="flex-1 bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-[12px] bg-primary text-white ios-body font-semibold active:bg-primary/90 transition-colors flex justify-center items-center disabled:opacity-60"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isLogin ? 'دخول للنظام' : 'إنشاء الحساب'
            )}
          </button>
        </form>

        {/* ── Footer Info ── */}
        {!isLogin && (
          <p className="ios-caption text-muted-foreground text-center px-4 leading-relaxed">
            بعد إنشاء الحساب، سيتم مراجعته من قبل المدير وتفعيله خلال وقت قصير.
          </p>
        )}
      </div>
    </div>
  )
}
