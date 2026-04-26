'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import {
  Users, Clock, CheckCircle2, Ban, UserCheck, UserX, ShieldAlert,
  Trash2, RefreshCw, Mail, Phone, Calendar, ChevronDown, ChevronUp,
  AlertTriangle, Settings2, Crown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PermissionEditor, { DEFAULT_PERMISSIONS } from './permission-editor'
import {
  getPendingUsers,
  getAllUsers,
  getSuspendedUsers,
  approveUser,
  rejectUser,
  updateUserPermissions,
  toggleUserActive,
  deleteUser,
  type UserWithPermissions,
  type UserPermissions,
} from '@/app/actions/users'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatDate(dateStr?: string, lang = 'ar') {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(dateStr))
}

function UserAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={cn(
      'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[14px] text-white shadow-sm flex-shrink-0',
      role === 'admin' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-primary to-indigo-500'
    )}>
      {initials || 'U'}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Pending User Card
// ────────────────────────────────────────────────────────────

function PendingUserCard({
  user,
  lang,
  onApprove,
  onReject,
}: {
  user: UserWithPermissions
  lang: string
  onApprove: (id: string, perms: UserPermissions) => Promise<void>
  onReject: (id: string) => Promise<void>
}) {
  const ar = lang === 'ar'
  const [expanded, setExpanded] = useState(false)
  const [perms, setPerms] = useState<UserPermissions>(DEFAULT_PERMISSIONS)
  const [isPending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  const handleApprove = () => {
    startTransition(async () => {
      await onApprove(user.id, perms)
    })
  }

  const handleReject = async () => {
    if (!confirmReject) { setConfirmReject(true); return }
    setRejecting(true)
    await onReject(user.id)
    setRejecting(false)
    setConfirmReject(false)
  }

  return (
    <div className="bg-card rounded-[16px] border border-amber-500/20 overflow-hidden transition-all duration-300">
      {/* Status bar */}
      <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />

      <div className="p-4">
        {/* User info row */}
        <div className="flex items-start gap-3">
          <UserAvatar name={user.full_name} role={user.role} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] font-semibold text-foreground">{user.full_name}</p>
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                {ar ? 'في الانتظار' : 'Pending'}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5" dir="ltr">
              <Mail className="w-3 h-3" />{user.email}
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {ar ? 'طلب في' : 'Requested'}: {formatDate(user.created_at, lang)}
            </p>
          </div>
        </div>

        {/* Expand permissions */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-accent/50 hover:bg-accent transition-colors"
        >
          <span className="text-[13px] font-medium text-foreground flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            {ar ? 'تحديد الصلاحيات' : 'Configure Permissions'}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="mt-3">
            <PermissionEditor
              lang={lang}
              initialPermissions={perms}
              onChange={setPerms}
              compact
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#34C759] hover:bg-[#2eb34f] text-white text-[14px] font-semibold transition-all disabled:opacity-60 shadow-sm shadow-green-500/20"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            {ar ? 'موافقة' : 'Approve'}
          </button>
          <button
            onClick={handleReject}
            disabled={rejecting}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-60',
              confirmReject
                ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            )}
          >
            {rejecting ? (
              <div className="w-4 h-4 border-2 border-red-300/30 border-t-red-300 rounded-full animate-spin" />
            ) : (
              <UserX className="w-4 h-4" />
            )}
            {confirmReject
              ? (ar ? 'تأكيد الرفض؟' : 'Confirm Reject?')
              : (ar ? 'رفض' : 'Reject')
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Active User Card
// ────────────────────────────────────────────────────────────

function ActiveUserCard({
  user,
  lang,
  onUpdatePerms,
  onSuspend,
  onDelete,
}: {
  user: UserWithPermissions
  lang: string
  onUpdatePerms: (id: string, perms: UserPermissions) => Promise<void>
  onSuspend: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const ar = lang === 'ar'
  const [editingPerms, setEditingPerms] = useState(false)
  const [newPerms, setNewPerms] = useState<UserPermissions>(
    user.permissions ?? DEFAULT_PERMISSIONS
  )
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSavePerms = async () => {
    setSaving(true)
    await onUpdatePerms(user.id, newPerms)
    setSaving(false)
    setEditingPerms(false)
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    await onDelete(user.id)
  }

  const activePermsCount = user.permissions
    ? Object.values(user.permissions).filter(Boolean).length
    : 0

  // Check if user was seen in last 5 minutes = online
  const isOnline = user.last_seen_at
    ? (Date.now() - new Date(user.last_seen_at).getTime()) < 5 * 60 * 1000
    : false

  const lastSeenText = () => {
    if (!user.last_seen_at) return ar ? 'لم يدخل بعد' : 'Never logged in'
    const diff = Date.now() - new Date(user.last_seen_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return ar ? 'الآن' : 'Just now'
    if (mins < 60) return ar ? `منذ ${mins} دقيقة` : `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return ar ? `منذ ${hours} ساعة` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    return ar ? `منذ ${days} يوم` : `${days}d ago`
  }

  return (
    <div className="bg-card rounded-[16px] border border-border/50 overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-primary/50 to-indigo-500/50" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <UserAvatar name={user.full_name} role={user.role} />
            {/* Online indicator dot */}
            <div className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card',
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] font-semibold text-foreground">{user.full_name}</p>
              {user.role === 'admin' && (
                <Crown className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                isOnline
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-gray-500/10 text-gray-500'
              )}>
                {isOnline
                  ? (ar ? '🟢 متصل' : '🟢 Online')
                  : (ar ? '⚫ غير متصل' : '⚫ Offline')
                }
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5" dir="ltr">
              {user.email}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[11px] text-muted-foreground">
                {activePermsCount} {ar ? 'صلاحية نشطة' : 'permissions active'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {ar ? 'آخر ظهور' : 'Last seen'}: {lastSeenText()}
              </span>
              {user.approved_at && (
                <span className="text-[11px] text-muted-foreground">
                  {ar ? 'وُوفق في' : 'Approved'}: {formatDate(user.approved_at, lang)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Edit Permissions */}
        {!editingPerms ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setEditingPerms(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-[13px] font-semibold transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {ar ? 'تعديل الصلاحيات' : 'Edit Permissions'}
            </button>
            <button
              onClick={() => onSuspend(user.id, !user.is_active)}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                user.is_active
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
              )}
            >
              <Ban className="w-3.5 h-3.5" />
              {user.is_active ? (ar ? 'إيقاف' : 'Suspend') : (ar ? 'تفعيل' : 'Activate')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors',
                confirmDelete
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              )}
            >
              {deleting
                ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />
              }
              {confirmDelete ? (ar ? 'تأكيد؟' : 'Sure?') : ''}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <PermissionEditor
              lang={lang}
              initialPermissions={user.permissions}
              onChange={setNewPerms}
              onSave={handleSavePerms}
              onCancel={() => setEditingPerms(false)}
              saving={saving}
              compact
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Empty State
// ────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

type Tab = 'pending' | 'active' | 'suspended'

export default function UserManagement({ lang }: { lang: string }) {
  const ar = lang === 'ar'
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [pendingUsers, setPendingUsers] = useState<UserWithPermissions[]>([])
  const [activeUsers, setActiveUsers] = useState<UserWithPermissions[]>([])
  const [suspendedUsers, setSuspendedUsers] = useState<UserWithPermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pending, active, suspended] = await Promise.all([
        getPendingUsers(),
        getAllUsers(),
        getSuspendedUsers(),
      ])
      setPendingUsers(pending)
      setActiveUsers(active)
      setSuspendedUsers(suspended)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Action handlers ──

  const handleApprove = async (userId: string, perms: UserPermissions) => {
    const res = await approveUser(userId, perms)
    if (res.success) {
      showToast(ar ? '✅ تمت الموافقة على المستخدم بنجاح' : '✅ User approved successfully')
      await loadData()
    } else {
      showToast(res.error ?? 'Error', 'error')
    }
  }

  const handleReject = async (userId: string) => {
    const res = await rejectUser(userId)
    if (res.success) {
      showToast(ar ? '🚫 تم رفض المستخدم' : '🚫 User rejected')
      await loadData()
    } else {
      showToast(res.error ?? 'Error', 'error')
    }
  }

  const handleUpdatePerms = async (userId: string, perms: UserPermissions) => {
    const res = await updateUserPermissions(userId, perms)
    if (res.success) {
      showToast(ar ? '✅ تم تحديث الصلاحيات' : '✅ Permissions updated')
      await loadData()
    } else {
      showToast(res.error ?? 'Error', 'error')
    }
  }

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    const res = await toggleUserActive(userId, isActive)
    if (res.success) {
      showToast(isActive
        ? (ar ? '✅ تم تفعيل الحساب' : '✅ Account activated')
        : (ar ? '⚠️ تم إيقاف الحساب' : '⚠️ Account suspended')
      )
      await loadData()
    } else {
      showToast(res.error ?? 'Error', 'error')
    }
  }

  const handleDelete = async (userId: string) => {
    const res = await deleteUser(userId)
    if (res.success) {
      showToast(ar ? '🗑️ تم حذف المستخدم نهائياً' : '🗑️ User permanently deleted')
      await loadData()
    } else {
      showToast(res.error ?? 'Error', 'error')
    }
  }

  // ── Tabs config ──

  const tabs = [
    {
      id: 'pending' as Tab,
      icon: Clock,
      label: ar ? 'في الانتظار' : 'Pending',
      count: pendingUsers.length,
      countColor: 'bg-amber-500',
    },
    {
      id: 'active' as Tab,
      icon: CheckCircle2,
      label: ar ? 'النشطين' : 'Active',
      count: activeUsers.length,
      countColor: 'bg-green-500',
    },
    {
      id: 'suspended' as Tab,
      icon: Ban,
      label: ar ? 'الموقوفين' : 'Suspended',
      count: suspendedUsers.length,
      countColor: 'bg-red-500',
    },
  ]

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl shadow-xl text-white text-[14px] font-semibold transition-all duration-300',
          toast.type === 'success' ? 'bg-[#34C759]' : 'bg-red-500'
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-[16px] font-bold text-foreground">
            {ar ? 'إدارة المستخدمين' : 'User Management'}
          </h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Pending Alert Badge */}
      {pendingUsers.length > 0 && activeTab !== 'pending' && (
        <button
          onClick={() => setActiveTab('pending')}
          className="w-full flex items-center gap-3 p-3.5 rounded-[14px] bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-[13px] font-semibold">
            {pendingUsers.length} {ar ? 'مستخدم ينتظر موافقتك — اضغط للمراجعة' : `user${pendingUsers.length > 1 ? 's' : ''} awaiting approval`}
          </span>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 bg-accent/60 rounded-[10px]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`user-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-[8px] text-[12px] font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span className={cn(
                'w-5 h-5 rounded-full text-[10px] text-white flex items-center justify-center font-bold',
                tab.countColor
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-[16px] h-[120px] animate-pulse border border-border/40" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 rounded-[14px] bg-red-500/10 text-red-500">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-[13px]">{error}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTab === 'pending' && (
            pendingUsers.length === 0
              ? <EmptyState
                  icon={Clock}
                  title={ar ? 'لا يوجد طلبات جديدة' : 'No pending requests'}
                  subtitle={ar ? 'ستظهر هنا طلبات التسجيل الجديدة' : 'New registration requests will appear here'}
                />
              : pendingUsers.map(u => (
                  <PendingUserCard
                    key={u.id}
                    user={u}
                    lang={lang}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))
          )}

          {activeTab === 'active' && (
            activeUsers.length === 0
              ? <EmptyState
                  icon={Users}
                  title={ar ? 'لا يوجد مستخدمين نشطين' : 'No active users'}
                  subtitle={ar ? 'وافق على مستخدم لتراه هنا' : 'Approve a user to see them here'}
                />
              : activeUsers.map(u => (
                  <ActiveUserCard
                    key={u.id}
                    user={u}
                    lang={lang}
                    onUpdatePerms={handleUpdatePerms}
                    onSuspend={handleToggleActive}
                    onDelete={handleDelete}
                  />
                ))
          )}

          {activeTab === 'suspended' && (
            suspendedUsers.length === 0
              ? <EmptyState
                  icon={Ban}
                  title={ar ? 'لا يوجد حسابات موقوفة' : 'No suspended accounts'}
                  subtitle={ar ? 'الحسابات الموقوفة ستظهر هنا' : 'Suspended accounts will appear here'}
                />
              : suspendedUsers.map(u => (
                  <ActiveUserCard
                    key={u.id}
                    user={u}
                    lang={lang}
                    onUpdatePerms={handleUpdatePerms}
                    onSuspend={handleToggleActive}
                    onDelete={handleDelete}
                  />
                ))
          )}
        </div>
      )}
    </div>
  )
}
