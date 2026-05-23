'use client'

import { useEffect, useState } from 'react'
import { Power, AlertTriangle, Check } from 'lucide-react'
import { getSystemControlAction, setSystemEnabledAction } from '@/app/actions/system'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function SystemControl({ lang }: { lang: string }) {
  const ar = lang === 'ar'
  const router = useRouter()
  const [enabled, setEnabled] = useState(true)
  const [messageAr, setMessageAr] = useState('النظام متوقف مؤقتاً. سنعود قريباً.')
  const [messageEn, setMessageEn] = useState('System is temporarily offline.')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    getSystemControlAction().then((res) => {
      if (res.success && res.data) {
        setEnabled(res.data.enabled !== false)
        if (res.data.message_ar) setMessageAr(res.data.message_ar)
        if (res.data.message_en) setMessageEn(res.data.message_en)
      }
      setLoading(false)
    })
  }, [])

  const handleToggle = async () => {
    const next = !enabled
    if (
      !next &&
      !window.confirm(
        ar
          ? 'إيقاف النظام سيمنع جميع المستخدمين من الدخول. المتابعة؟'
          : 'Stopping the system blocks all users. Continue?'
      )
    ) {
      return
    }

    setSaving(true)
    setFeedback('')
    const res = await setSystemEnabledAction(next, {
      message_ar: messageAr,
      message_en: messageEn,
    })
    setSaving(false)

    if (res.success) {
      setEnabled(next)
      setFeedback(ar ? (next ? 'تم تشغيل النظام' : 'تم إيقاف النظام') : next ? 'System enabled' : 'System stopped')
      router.refresh()
    } else {
      setFeedback(res.error || (ar ? 'فشل الحفظ' : 'Save failed'))
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-[14px] p-6 text-center text-muted-foreground ios-body">
        {ar ? 'جاري التحميل...' : 'Loading...'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'bg-card rounded-[14px] p-4 border-2',
          enabled ? 'border-border' : 'border-amber-500/40 bg-amber-500/5'
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
              enabled ? 'bg-[#34C759]/10' : 'bg-amber-500/15'
            )}
          >
            <Power
              className={cn(
                'w-5 h-5',
                enabled ? 'text-[#34C759]' : 'text-amber-600 dark:text-amber-400'
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="ios-body font-semibold text-foreground">
              {ar ? 'تشغيل / إيقاف النظام' : 'System on / off'}
            </p>
            <p className="ios-caption text-muted-foreground mt-0.5">
              {enabled
                ? ar
                  ? 'النظام يعمل — جميع المستخدمين يمكنهم الدخول'
                  : 'System is running — all users can sign in'
                : ar
                  ? 'النظام متوقف — المستخدمون يرون صفحة الإيقاف'
                  : 'System is stopped — users see the offline page'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={cn(
              'relative w-[51px] h-[31px] rounded-full transition-colors shrink-0 disabled:opacity-50',
              enabled ? 'bg-[#34C759]' : 'bg-amber-500'
            )}
            aria-label={ar ? 'تبديل حالة النظام' : 'Toggle system'}
          >
            <span
              className={cn(
                'absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform',
                enabled && 'translate-x-[20px]'
              )}
            />
          </button>
        </div>

        {!enabled && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[13px]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {ar
                ? 'لإعادة التشغيل: فعّل المفتاح أعلاه. أو من Vercel: احذف MAINTENANCE_MODE من Environment Variables.'
                : 'To restart: enable the switch above, or remove MAINTENANCE_MODE in Vercel env.'}
            </span>
          </div>
        )}
      </div>

      <div className="bg-card rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <label className="ios-caption text-muted-foreground block mb-1">
            {ar ? 'رسالة الإيقاف (عربي)' : 'Offline message (Arabic)'}
          </label>
          <textarea
            rows={2}
            value={messageAr}
            onChange={(e) => setMessageAr(e.target.value)}
            className="w-full bg-transparent ios-body text-foreground focus:outline-none resize-none"
          />
        </div>
        <div className="px-4 py-3">
          <label className="ios-caption text-muted-foreground block mb-1">
            {ar ? 'رسالة الإيقاف (إنجليزي)' : 'Offline message (English)'}
          </label>
          <textarea
            rows={2}
            value={messageEn}
            onChange={(e) => setMessageEn(e.target.value)}
            className="w-full bg-transparent ios-body text-foreground focus:outline-none resize-none"
            dir="ltr"
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            setSaving(true)
            const res = await setSystemEnabledAction(enabled, {
              message_ar: messageAr,
              message_en: messageEn,
            })
            setSaving(false)
            if (res.success) {
              setFeedback(ar ? 'تم حفظ الرسالة' : 'Message saved')
              router.refresh()
            } else {
              setFeedback(res.error || '')
            }
          }}
          disabled={saving}
          className="w-full py-3 ios-body font-semibold text-primary border-t border-border active:bg-accent/60 disabled:opacity-50"
        >
          {ar ? 'حفظ الرسالة' : 'Save message'}
        </button>
      </div>

      {feedback && (
        <p
          className={cn(
            'text-[13px] font-medium flex items-center gap-1.5 px-1',
            feedback.includes('فشل') || feedback.includes('failed') || feedback.includes('غير')
              ? 'text-red-600'
              : 'text-green-600'
          )}
        >
          <Check className="w-4 h-4" />
          {feedback}
        </p>
      )}
    </div>
  )
}
