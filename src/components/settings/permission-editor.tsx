'use client'

import { useState } from 'react'
import {
  LayoutDashboard, ShoppingBag, Wallet, Package, Users, Settings,
  Trash2, Download, PenLine, Plus, X, Check, ShieldCheck, ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserPermissions } from '@/app/actions/users'

// ────────────────────────────────────────────────────────────
// Permission definitions (label, icon, key)
// ────────────────────────────────────────────────────────────

const PAGE_PERMISSIONS = [
  { key: 'perm_dashboard',   icon: LayoutDashboard, labelAr: 'لوحة التحكم',     labelEn: 'Dashboard' },
  { key: 'perm_orders',      icon: ShoppingBag,     labelAr: 'الطلبات',          labelEn: 'Orders' },
  { key: 'perm_accounting',  icon: Wallet,          labelAr: 'الحسابات',         labelEn: 'Accounting' },
  { key: 'perm_inventory',   icon: Package,         labelAr: 'المخزون',          labelEn: 'Inventory' },
  { key: 'perm_customers',   icon: Users,           labelAr: 'العملاء',          labelEn: 'Customers' },
  { key: 'perm_settings',    icon: Settings,        labelAr: 'الإعدادات',        labelEn: 'Settings' },
] as const

const ACTION_PERMISSIONS = [
  { key: 'perm_can_create', icon: Plus,     labelAr: 'إضافة',        labelEn: 'Create' },
  { key: 'perm_can_edit',   icon: PenLine,  labelAr: 'تعديل',        labelEn: 'Edit' },
  { key: 'perm_can_delete', icon: Trash2,   labelAr: 'حذف',          labelEn: 'Delete', danger: true },
  { key: 'perm_can_export', icon: Download, labelAr: 'تصدير',        labelEn: 'Export' },
] as const

export const DEFAULT_PERMISSIONS: UserPermissions = {
  perm_dashboard: true,
  perm_orders: false,
  perm_accounting: false,
  perm_inventory: false,
  perm_customers: false,
  perm_settings: false,
  perm_can_delete: false,
  perm_can_export: false,
  perm_can_create: true,
  perm_can_edit: true,
}

// ────────────────────────────────────────────────────────────
// Toggle Switch
// ────────────────────────────────────────────────────────────

function PermissionToggle({
  enabled,
  onChange,
  danger = false,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex items-center h-[28px] w-[50px] rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        enabled
          ? danger ? 'bg-red-500' : 'bg-[#34C759]'
          : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'absolute left-[2px] top-[2px] w-[24px] h-[24px] bg-white rounded-full shadow-md transition-transform duration-300',
          enabled ? 'translate-x-[22px]' : 'translate-x-0'
        )}
      />
    </button>
  )
}

// ────────────────────────────────────────────────────────────
// Permission Editor — embedded or in a modal
// ────────────────────────────────────────────────────────────

interface PermissionEditorProps {
  lang: string
  initialPermissions?: Partial<UserPermissions>
  onChange?: (perms: UserPermissions) => void
  onSave?: (perms: UserPermissions) => Promise<void>
  onCancel?: () => void
  saving?: boolean
  compact?: boolean // minimal view for inside the approval card
}

export default function PermissionEditor({
  lang,
  initialPermissions,
  onChange,
  onSave,
  onCancel,
  saving = false,
  compact = false,
}: PermissionEditorProps) {
  const ar = lang === 'ar'
  const [perms, setPerms] = useState<UserPermissions>({
    ...DEFAULT_PERMISSIONS,
    ...initialPermissions,
  })

  const set = (key: keyof UserPermissions, value: boolean) => {
    const updated = { ...perms, [key]: value }
    setPerms(updated)
    onChange?.(updated)
  }

  const selectAll = () => {
    const all: UserPermissions = {
      perm_dashboard: true, perm_orders: true, perm_accounting: true,
      perm_inventory: true, perm_customers: true, perm_settings: true,
      perm_can_delete: true, perm_can_export: true, perm_can_create: true,
      perm_can_edit: true,
    }
    setPerms(all)
    onChange?.(all)
  }

  const resetToDefault = () => {
    setPerms(DEFAULT_PERMISSIONS)
    onChange?.(DEFAULT_PERMISSIONS)
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Header row */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-[14px] font-semibold text-foreground">
              {ar ? 'تحديد الصلاحيات' : 'Set Permissions'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-primary font-medium hover:underline"
            >
              {ar ? 'تحديد الكل' : 'Select All'}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={resetToDefault}
              className="text-[11px] text-muted-foreground hover:text-foreground font-medium hover:underline"
            >
              {ar ? 'إعادة تعيين' : 'Reset'}
            </button>
          </div>
        </div>
      )}

      {/* Page access */}
      <div className="bg-card rounded-[14px] overflow-hidden border border-border/50">
        <div className="px-4 py-2.5 border-b border-border bg-accent/30">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {ar ? 'الوصول إلى الصفحات' : 'Page Access'}
          </span>
        </div>
        <div className="divide-y divide-border">
          {PAGE_PERMISSIONS.map((p) => (
            <div key={p.key} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center',
                  perms[p.key] ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'
                )}>
                  <p.icon className="w-3.5 h-3.5" />
                </div>
                <span className={cn(
                  'text-[14px] font-medium transition-colors',
                  perms[p.key] ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {ar ? p.labelAr : p.labelEn}
                </span>
              </div>
              <PermissionToggle
                enabled={perms[p.key as keyof UserPermissions] as boolean}
                onChange={(v) => set(p.key as keyof UserPermissions, v)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action permissions */}
      <div className="bg-card rounded-[14px] overflow-hidden border border-border/50">
        <div className="px-4 py-2.5 border-b border-border bg-accent/30">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {ar ? 'صلاحيات الإجراءات' : 'Action Permissions'}
          </span>
        </div>
        <div className="divide-y divide-border">
          {ACTION_PERMISSIONS.map((p) => (
            <div key={p.key} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center',
                  (p as any).danger && perms[p.key as keyof UserPermissions]
                    ? 'bg-red-500/10 text-red-500'
                    : perms[p.key as keyof UserPermissions]
                    ? 'bg-primary/10 text-primary'
                    : 'bg-accent text-muted-foreground'
                )}>
                  <p.icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className={cn(
                    'text-[14px] font-medium transition-colors',
                    perms[p.key as keyof UserPermissions] ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {ar ? p.labelAr : p.labelEn}
                  </span>
                  {(p as any).danger && (
                    <p className="text-[11px] text-red-400">
                      {ar ? 'صلاحية خطرة — بحذر' : 'Sensitive permission'}
                    </p>
                  )}
                </div>
              </div>
              <PermissionToggle
                enabled={perms[p.key as keyof UserPermissions] as boolean}
                onChange={(v) => set(p.key as keyof UserPermissions, v)}
                danger={(p as any).danger}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons (if onSave provided) */}
      {onSave && (
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-accent text-foreground text-[14px] font-semibold hover:bg-accent/80 transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onSave(perms)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-primary text-white text-[14px] font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {ar ? 'حفظ الصلاحيات' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  )
}
