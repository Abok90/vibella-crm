'use client'

import { useState } from 'react'
import { loginAction, signupAction } from '@/app/actions/auth'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)

    try {
      const result = isLogin
        ? await loginAction(formData)
        : await signupAction(formData)

      if (result && result.error) {
        setError(result.error)
      }
    } catch (err: any) {
      if (err.message !== 'NEXT_REDIRECT') {
        setError(err.message || 'حدث خطأ غير متوقع')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 gap-6" dir="rtl">
      <div className="flex flex-col items-center justify-center mb-2">
        <div className="w-16 h-16 rounded-[18px] bg-primary flex items-center justify-center mb-3 shadow-lg">
          <span className="text-white text-2xl font-bold">E</span>
        </div>
        <h1 className="ios-large-title text-foreground">Elite EG</h1>
        <p className="ios-subheadline text-muted-foreground mt-0.5">نظام إدارة المبيعات</p>
      </div>

      <div className="w-full max-w-[360px] space-y-3">
        <div className="flex gap-0.5 p-0.5 bg-accent/60 rounded-[9px]">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={cn("flex-1 py-1.5 text-[13px] font-semibold rounded-[7px] transition-all",
              isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            تسجيل دخول
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={cn("flex-1 py-1.5 text-[13px] font-semibold rounded-[7px] transition-all",
              !isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            إنشاء حساب
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="bg-[#FF3B30]/10 text-[#FF3B30] rounded-[10px] px-3 py-2 ios-footnote text-center font-semibold">
              {error}
            </div>
          )}

          <div className="bg-card rounded-[14px] overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <label className="ios-caption text-muted-foreground block mb-1">البريد الإلكتروني</label>
              <input
                dir="ltr"
                type="email"
                name="email"
                required
                className="w-full bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                placeholder="name@company.com"
              />
            </div>
            <div className="px-4 py-3">
              <label className="ios-caption text-muted-foreground block mb-1">كلمة المرور</label>
              <input
                dir="ltr"
                type="password"
                name="password"
                required
                className="w-full bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                placeholder="••••••••"
              />
            </div>
          </div>

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
      </div>
    </div>
  )
}
