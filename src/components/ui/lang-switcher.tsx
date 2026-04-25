'use client'

import { usePathname, useRouter } from 'next/navigation'

export function LangSwitcher({ currentLang }: { currentLang: 'ar' | 'en' }) {
  const router = useRouter()
  const pathname = usePathname()

  const toggleLanguage = () => {
    const nextLang = currentLang === 'ar' ? 'en' : 'ar'
    const newPath = pathname.replace(`/${currentLang}`, `/${nextLang}`)
    router.push(newPath)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-primary active:bg-accent transition-colors"
      suppressHydrationWarning
    >
      {currentLang === 'ar' ? 'EN' : 'ع'}
    </button>
  )
}
