'use client'

import { useState, useRef, useEffect } from 'react'
import { User, Bell, Shield, Paintbrush, Save, Check, Settings2, BarChart2, Upload, Image as ImageIcon, Sun, Moon, Monitor, Users } from 'lucide-react'
import StatusesSettings from './statuses-settings'
import CategoriesSettings from './categories-settings'
import UserManagement from './user-management'
import { cn } from '@/lib/utils'

export default function SettingsContent({ lang, isAdmin = false }: { lang: string; isAdmin?: boolean }) {
  const [activeTab, setActiveTab] = useState('account')
  const [storeName, setStoreName] = useState('Vibella')
  const [storePhone, setStorePhone] = useState('')
  const [saved, setSaved] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)
  const [theme, setTheme] = useState<string>('system')
  const fileRef = useRef<HTMLInputElement>(null)

  // Load saved logo & theme from localStorage
  useEffect(() => {
    const savedLogo = localStorage.getItem('vibella-logo')
    if (savedLogo) setLogo(savedLogo)
    const savedTheme = localStorage.getItem('theme') || 'system'
    setTheme(savedTheme)
  }, [])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert(lang === 'ar' ? 'حجم الصورة كبير جداً (الحد 2MB)' : 'File too large (max 2MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setLogo(result)
      localStorage.setItem('vibella-logo', result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setLogo(null)
    localStorage.removeItem('vibella-logo')
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else if (newTheme === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  const tabs = [
    { id: 'account', icon: User, label: lang === 'ar' ? 'حسابي' : 'My Account' },
    { id: 'settings_statuses', icon: Settings2, label: lang === 'ar' ? 'حالات الطلبات' : 'Order Statuses' },
    { id: 'settings_categories', icon: BarChart2, label: lang === 'ar' ? 'بنود الحسابات' : 'Categories' },
    { id: 'notifications', icon: Bell, label: lang === 'ar' ? 'الإشعارات' : 'Notifications' },
    { id: 'security', icon: Shield, label: lang === 'ar' ? 'الأمان' : 'Security' },
    { id: 'appearance', icon: Paintbrush, label: lang === 'ar' ? 'المظهر' : 'Appearance' },
    ...(isAdmin ? [{ id: 'user_management', icon: Users, label: lang === 'ar' ? 'المستخدمين' : 'Users' }] : []),
  ]

  const activeLabel = tabs.find(t => t.id === activeTab)?.label || ''

  const themeOptions = [
    { id: 'light', icon: Sun, label: lang === 'ar' ? 'فاتح' : 'Light' },
    { id: 'dark', icon: Moon, label: lang === 'ar' ? 'داكن' : 'Dark' },
    { id: 'system', icon: Monitor, label: lang === 'ar' ? 'تلقائي' : 'System' },
  ]

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <h1 className="ios-large-title text-foreground">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h1>
      </div>

      {/* Segmented tabs — horizontal scroll */}
      <div className="flex gap-1 p-0.5 bg-accent/60 rounded-[9px] overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[13px] font-semibold transition-all whitespace-nowrap",
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" strokeWidth={2} />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        <h3 className="ios-footnote text-muted-foreground uppercase tracking-wider mb-2 px-1">{activeLabel}</h3>

        {activeTab === 'account' && (
          <div className="space-y-3">
            {/* Logo Upload */}
            <div className="bg-card rounded-[14px] p-4">
              <label className="ios-caption text-muted-foreground block mb-3">
                {lang === 'ar' ? 'شعار المتجر' : 'Store Logo'}
              </label>
              <div className="flex items-center gap-4">
                <div 
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5",
                    logo ? "border-primary/30 p-1" : "border-border"
                  )}
                >
                  {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground">
                        {lang === 'ar' ? 'رفع' : 'Upload'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="ios-body text-foreground font-medium">
                    {logo ? (lang === 'ar' ? 'تم رفع الشعار' : 'Logo uploaded') : (lang === 'ar' ? 'اضغط لرفع الشعار' : 'Click to upload')}
                  </p>
                  <p className="ios-caption text-muted-foreground mt-0.5">
                    PNG, JPG, SVG — {lang === 'ar' ? 'الحد الأقصى 2MB' : 'Max 2MB'}
                  </p>
                  {logo && (
                    <button 
                      onClick={handleRemoveLogo}
                      className="mt-1.5 text-[12px] text-red-500 hover:text-red-400 font-medium transition-colors"
                    >
                      {lang === 'ar' ? 'إزالة الشعار' : 'Remove logo'}
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            {/* Store Info */}
            <div className="bg-card rounded-[14px] overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <label className="ios-caption text-muted-foreground block mb-1">{lang === 'ar' ? 'اسم المتجر' : 'Store Name'}</label>
                <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
                  className="w-full bg-transparent ios-body text-foreground focus:outline-none" />
              </div>
              <div className="px-4 py-3">
                <label className="ios-caption text-muted-foreground block mb-1">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                <input type="tel" value={storePhone} onChange={e => setStorePhone(e.target.value)} placeholder="01X XXXX XXXX"
                  className="w-full bg-transparent ios-body text-foreground focus:outline-none placeholder:text-muted-foreground"
                  dir="ltr" />
              </div>
              <button onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 py-3 ios-body font-semibold text-primary border-t border-border active:bg-accent/60 transition-colors">
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? (lang === 'ar' ? 'تم الحفظ' : 'Saved') : (lang === 'ar' ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-card rounded-[14px] overflow-hidden">
            {[
              { label: lang === 'ar' ? 'إشعارات الطلبات الجديدة' : 'New order notifications', default: true },
              { label: lang === 'ar' ? 'تنبيهات المخزون المنخفض' : 'Low stock alerts', default: true },
              { label: lang === 'ar' ? 'تقارير يومية بالبريد' : 'Daily email reports', default: false },
            ].map((item, i, arr) => (
              <div key={i} className={cn("flex items-center justify-between px-4 py-3", i < arr.length - 1 && "border-b border-border")}>
                <span className="ios-body text-foreground">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                  <div className="w-[51px] h-[31px] bg-accent rounded-full peer peer-checked:bg-[#34C759] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-[27px] after:w-[27px] after:transition-all after:shadow peer-checked:after:translate-x-[20px]"></div>
                </label>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="bg-card rounded-[14px] overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <label className="ios-caption text-muted-foreground block mb-1">{lang === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}</label>
              <input type="password" className="w-full bg-transparent ios-body text-foreground focus:outline-none" />
            </div>
            <div className="px-4 py-3">
              <label className="ios-caption text-muted-foreground block mb-1">{lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</label>
              <input type="password" className="w-full bg-transparent ios-body text-foreground focus:outline-none" />
            </div>
            <button className="w-full py-3 ios-body font-semibold text-primary border-t border-border active:bg-accent/60 transition-colors">
              {lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
            </button>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-3">
            {/* Theme Selector */}
            <div className="bg-card rounded-[14px] p-4">
              <p className="ios-caption text-muted-foreground mb-3">
                {lang === 'ar' ? 'اختر المظهر المفضل' : 'Choose your preferred theme'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleThemeChange(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200",
                      theme === opt.id 
                        ? "border-primary bg-primary/5 shadow-sm" 
                        : "border-border hover:border-primary/30 hover:bg-accent/40"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      theme === opt.id ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
                    )}>
                      <opt.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      "text-[12px] font-semibold",
                      theme === opt.id ? "text-primary" : "text-muted-foreground"
                    )}>
                      {opt.label}
                    </span>
                    {theme === opt.id && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Version Info */}
            <div className="bg-card rounded-[14px] p-4">
              <div className="flex items-center justify-between">
                <span className="ios-body text-foreground">{lang === 'ar' ? 'إصدار النظام' : 'System Version'}</span>
                <span className="ios-caption text-muted-foreground font-mono">v1.1.0</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings_statuses' && <StatusesSettings lang={lang} />}
        {activeTab === 'settings_categories' && <CategoriesSettings lang={lang} />}
        {activeTab === 'user_management' && isAdmin && <UserManagement lang={lang} />}
      </div>
    </div>
  )
}
