'use client'

import { useEffect, useState } from 'react'
import { X, Download, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
              }
            })
          }
        })
      })
    }

    // Install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      // Show after 5 seconds
      setTimeout(() => setShowInstall(true), 5000)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Online/offline
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
    setShowInstall(false)
  }

  return (
    <>
      {/* Offline indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center py-1.5 text-[13px] font-medium"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            ⚡ أنت غير متصل بالإنترنت — يتم عرض البيانات المخزنة مؤقتاً
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install prompt */}
      <AnimatePresence>
        {showInstall && installPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-80 z-[100] glass-strong rounded-2xl p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground">تثبيت Vibella</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">أضف التطبيق لشاشة الرئيسية للوصول السريع</p>
              </div>
              <button onClick={() => setShowInstall(false)} className="p-1 rounded-full hover:bg-accent">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <button
              onClick={handleInstall}
              className="w-full mt-3 gradient-primary text-white rounded-xl py-2.5 text-[14px] font-semibold shadow-md shadow-primary/25 active:scale-[0.98] transition-transform"
            >
              تثبيت الآن
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update available */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-80 z-[100] glass-strong rounded-2xl p-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-[13px] text-foreground flex-1">يتوفر تحديث جديد</p>
              <button
                onClick={() => window.location.reload()}
                className="gradient-primary text-white rounded-xl px-4 py-1.5 text-[13px] font-semibold"
              >
                تحديث
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
