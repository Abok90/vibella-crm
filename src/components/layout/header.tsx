'use client'

import { Bell, Search, X, Moon, Sun } from 'lucide-react'
import { LangSwitcher } from '../ui/lang-switcher'
import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../providers/theme-provider'

export function Header({ dict, lang }: { dict: any, lang: 'ar' | 'en' }) {
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    if (!showNotifications) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header
      className="glass-strong border-b border-border sticky top-0 z-30"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-4 min-w-0">
          <div className="relative w-full max-w-md hidden md:block">
            <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <input
              type="text"
              placeholder={dict.header.search}
              className="w-full bg-accent/60 border border-border rounded-xl py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-muted-foreground"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              style={{ paddingRight: lang === 'ar' ? '2.25rem' : '0.75rem', paddingLeft: lang === 'en' ? '2.25rem' : '0.75rem'}}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-accent/60 active:scale-95 transition-all duration-200"
            title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-[18px] h-[18px] text-amber-400" strokeWidth={1.8} />
            ) : (
              <Moon className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.8} />
            )}
          </button>

          <LangSwitcher currentLang={lang} />

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl hover:bg-accent/60 active:scale-95 transition-all duration-200"
            >
              <Bell className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.8} />
            </button>

            {showNotifications && (
              <div className={`absolute top-full mt-2 ${lang === 'ar' ? 'left-0' : 'right-0'} w-[calc(100vw-1.5rem)] max-w-xs glass rounded-2xl shadow-xl z-40 overflow-hidden`}>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <h3 className="ios-headline text-foreground">{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</h3>
                  <button onClick={() => setShowNotifications(false)} className="p-1 rounded-full hover:bg-accent">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="ios-footnote">{lang === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-[13px] shadow-sm flex-shrink-0">
            A
          </div>
        </div>
      </div>
    </header>
  )
}
