'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Package, Settings, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNav({ lang, userRole }: { lang: string, userRole?: string }) {
  const pathname = usePathname()

  let navItems = [
    { href: `/${lang}`, icon: LayoutDashboard, label: lang === 'ar' ? 'الرئيسية' : 'Home' },
    { href: `/${lang}/orders`, icon: ShoppingBag, label: lang === 'ar' ? 'الطلبات' : 'Orders' },
    { href: `/${lang}/accounting`, icon: Wallet, label: lang === 'ar' ? 'المالية' : 'Finance' },
    { href: `/${lang}/inventory`, icon: Package, label: lang === 'ar' ? 'المخزون' : 'Inventory' },
  ]

  if (userRole === 'admin') {
    navItems.push({ href: `/${lang}/settings`, icon: Settings, label: lang === 'ar' ? 'الإعدادات' : 'Settings' })
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="glass-strong rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30">
        <div className="flex items-center justify-between px-1 py-1.5 h-[56px]">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== `/${lang}`)
            return (
              <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive ? "gradient-primary shadow-md shadow-primary/25" : ""
                )}>
                  <item.icon
                    className={cn(
                      "w-[22px] h-[22px] transition-all duration-200",
                      isActive ? "text-white" : "text-muted-foreground"
                    )}
                    strokeWidth={isActive ? 2.2 : 1.7}
                  />
                </div>
                <span className={cn(
                  "text-[10px] leading-tight tracking-tight transition-all duration-200 truncate px-1",
                  isActive ? "text-primary font-bold" : "text-muted-foreground font-medium"
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
