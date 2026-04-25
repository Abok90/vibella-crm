'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Wallet, Package, Users, Settings, LogOut, ShieldAlert, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/app/actions/auth'
import packageJson from '../../../package.json'

export function Sidebar({ dict, lang, userEmail, userRole }: { dict: any, lang: string, userEmail?: string, userRole?: string }) {
  const pathname = usePathname()
  
  let navItems = [
    { href: `/${lang}`, icon: LayoutDashboard, label: dict.navigation.dashboard },
    { href: `/${lang}/orders`, icon: ShoppingBag, label: dict.navigation.orders },
    { href: `/${lang}/accounting`, icon: Wallet, label: dict.navigation.accounting },
    { href: `/${lang}/inventory`, icon: Package, label: dict.navigation.inventory },
    { href: `/${lang}/customers`, icon: Users, label: dict.navigation.customers },
    { href: `/${lang}/settings`, icon: Settings, label: dict.navigation.settings },
  ]
  
  if (userRole !== 'admin') {
    navItems = navItems.filter(item => item.href !== `/${lang}/settings`)
  }

  return (
    <aside className="hidden md:flex w-64 glass-strong flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2.5">
          <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {dict.navigation.brand}
        </h1>
        <span className="text-[10px] gradient-primary text-white px-2 py-0.5 rounded-full font-semibold">
          v{packageJson.version}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== `/${lang}`)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "gradient-primary text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <item.icon
                  className={cn("w-[18px] h-[18px] transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                  )}
                  strokeWidth={isActive ? 2.2 : 1.7}
                />
                <span className="text-[14px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-white/10" />
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="px-3 py-2.5 flex items-center gap-3 rounded-xl bg-accent/40">
           <div className="w-9 h-9 rounded-xl gradient-primary text-white flex items-center justify-center font-bold text-[14px] shadow-sm">
             {userEmail?.charAt(0).toUpperCase() || 'U'}
           </div>
           <div className="overflow-hidden flex-1">
             <p className="ios-footnote font-semibold truncate text-foreground" dir="ltr">{userEmail}</p>
             <p className="ios-caption text-muted-foreground capitalize flex items-center gap-1">
               {userRole === 'admin' && <ShieldAlert className="w-3 h-3 text-primary" />} {userRole || 'Employee'}
             </p>
           </div>
        </div>
        <button onClick={() => logoutAction()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-red-500 hover:bg-red-500/10 transition-all duration-200">
          <LogOut className="w-[18px] h-[18px] pointer-events-none" strokeWidth={1.8} />
          <span className="text-[14px] font-medium pointer-events-none">{dict.navigation.logout}</span>
        </button>
      </div>
    </aside>
  )
}
