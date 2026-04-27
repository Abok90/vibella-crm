'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, Plus, Trash2, ChevronDown, Phone, MapPin, MessageCircle, Package, Calendar, Edit3, Download, CheckSquare, Square, Check, Copy, Truck, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { ManualEntryDrawer } from './manual-entry-drawer'
import { OrderDetailsDrawer } from './order-details-drawer'
import { deleteOrderAction, updateOrderStatusAction, recordWhatsAppSentAction, saveWaybillAction } from '@/app/actions/orders'
import { syncShopifyOrderAction } from '@/app/actions/shopify'
import { checkOrderShippingStatusAction, syncShippingStatusesAction } from '@/app/actions/shipping-tracker'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

// Dynamic status handler inside component now

function WhatsAppLink({ order }: { order: any }) {
  const [isSending, setIsSending] = useState(false);
  
  const history = order.whatsapp_history || {};
  const [localIsSent, setLocalIsSent] = useState(history[order.status] === true);

  // Sync state if order prop changes from server
  useEffect(() => {
    setLocalIsSent(order.whatsapp_history?.[order.status] === true)
  }, [order.whatsapp_history, order.status])

  if (!order.phone) return null
  const clean = order.phone.replace(/\D/g, '')
  const intl = clean.startsWith('0') ? '2' + clean : clean

  const handleSend = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (localIsSent) {
      const confirmSend = window.confirm("لقد تم إرسال رسالة لهذه الحالة مسبقاً، هل أنت متأكد أنك تريد إرسالها مجدداً؟");
      if (!confirmSend) return;
    }

    let msg = '';
    const name = order.customer || 'عميلنا';
    const amount = Number(order.amount).toLocaleString() + ' ج.م';
    const orderNum = '#' + String(order.id).replace(/^#/, '');

    switch(order.status) {
      case 'pending':
        msg = `مرحباً ${name}، 👋\nأهلاً بك في متجرنا!\nتم استلام طلبك (رقم ${orderNum}) بنجاح وهو الآن قيد المراجعة.\nأحد ممثلي خدمة العملاء سيقوم بمراجعة الطلب قريباً. سعداء بانضمامك لنا للتأكيد. 🌷`;
        break;
      case 'confirmed':
        msg = `مرحباً ${name}، ✨\nيسعدنا إبلاغك أنه تم تأكيد طلبك رقم ${orderNum} بنجاح!\n- الإجمالي المطلوب تحضيره: ${amount}\n\nجاري الآن تجهيز وتغليف طلبك بكل حب. سنقوم بتحديثك فور خروجه للشحن. 📦`;
        break;
      case 'shipped':
      case 'out_for_delivery':
        msg = `أهلاً بك ${name}، 🚐\nخبر رائع! طلبك رقم ${orderNum} خرج للشحن وهو الآن في الطريق إليك.\n\n📄 تفاصيل الطلب:\n▪️ قيمة الطلب والشحن: ${amount}\n▪️ العنوان المسجل: ${order.address || '-'}\n\nالمندوب سيتواصل معك قريباً على هذا الرقم لتسليم الشحنة، يرجى الرد عليه لضمان سرعة التوصيل. يومك سعيد! 🌟`;
        break;
      case 'delivered':
      case 'completed':
        msg = `مرحباً ${name}، ❤️\nنتمنى أن يكون طلبك قد وصلك بالسلامة وأن ينال إعجابك!\n\nلأن رأيك هو أهم شيء بالنسبة لنا لتطوير خدمتنا، هل يمكنك مشاركتنا تقييمك للمنتج وتجربة الشراء؟\n(يكفي الرد على هذه الرسالة بملاحظاتك).\nشكراً لاختيارك لنا! 🛍️`;
        break;
      case 'cancelled':
        msg = `مرحباً ${name}، 🍂\nنأسف لإبلاغك بأنه تم إلغاء طلبك رقم ${orderNum} بناءً على التحديثات الأخيرة.\n\nنتمنى دائماً أن نراك مجدداً وأن نحظى بفرصة خدمتك في مرات قادمة. إذا كان هناك أي خطأ أو لديك استفسار، نحن هنا بخدمتك. 🙏`;
        break;
      case 'returned':
      case 'returned_cash':
      case 'failed':
        msg = `مرحباً ${name}، 📞\nلاحظنا في النظام أنه تم إرجاع شحنتك رقم ${orderNum} (عدم استلام).\n\nيهمنا جداً التأكد من مستوى الخدمة المقدمة لك؛ هل واجهتك أي مشكلة مع المندوب؟ أم كان هناك تأخير أو سبب معين منعك من الاستلام؟\nيرجى إعلامنا لنقوم بحل المشكلة فوراً ومحاسبة المقصر. رضاك هو أولويتنا! 🛡️`;
        break;
      default:
        msg = `مرحباً ${name}،\nتفاصيل طلبك رقم ${orderNum}:\nالإجمالي: ${amount}\nحالة الطلب: ${order.status}`;
        break;
    }

    const url = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
    
    // Fix empty white page issue on mobile
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = url
    } else {
      window.open(url, '_blank')
    }
    
    // Only record if it hasn't been sent yet for this status
    if (!localIsSent) {
      setLocalIsSent(true) // Optimistic UI update instantly! No reload needed
      setIsSending(true)
      await recordWhatsAppSentAction(order.originalId || order.id, order.status)
      setIsSending(false)
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={isSending}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors font-medium border text-[11px]",
        localIsSent 
         ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/15" 
         : "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/20",
        isSending && "opacity-50"
      )}
      title="مراسلة عبر واتساب"
    >
      <MessageCircle className="w-3.5 h-3.5" />
      <span className="hidden lg:inline-block">{localIsSent ? "مرسل ✅" : "واتساب"}</span>
    </button>
  )
}

function ShippingCopyButton({ order }: { order: any }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const orderNum = '#' + String(order.id).replace(/^#/, '');
    const name = order.customer || 'غير محدد';
    const phone = order.phone || '-';
    // Clean address if needed (it already renders clean, just take what is there)
    const address = order.address || 'غير محدد';
    const amount = Number(order.amount).toLocaleString() + ' ج.م';
    // If order has a custom "content", use it, otherwise generic text
    const items = order.items && order.items.length > 0
      ? order.items.map((i: any) => `${i.name || i.product_name} (${i.quantity || 1})`).join(', ')
      : 'منتجات طبقا للطلب';
    
    // You can parse Notes from history or order object if they exist.
    const comment = order.comment ? `\n▪️ ملاحظات: ${order.comment}` : "";

    const text = `📦 طلب جديد للشحن
━━━━━━━━━━━━━━━━━
▪️ رقم الطلب: ${orderNum}
▪️ اسم العميل: ${name}
▪️ رقم الهاتف: ${phone}
▪️ العنوان بالتفصيل: ${address}
━━━━━━━━━━━━━━━━━
🛍️ المنتج/التفاصيل: 
${items}${comment}
━━━━━━━━━━━━━━━━━
💵 إجمالي التحصيل (COD): ${amount}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast("تم نسخ بيانات الشحن بنجاح", "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-full transition-colors font-medium border text-[11px]",
        copied 
         ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
         : "bg-muted text-muted-foreground border-border hover:bg-accent"
      )}
      title="نسخ للشحن"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="hidden lg:inline-block">الشحن</span>
    </button>
  );
}

function TrackingButton({ order }: { order: any }) {
  const [tracking, setTracking] = useState(false);
  const [statusText, setStatusText] = useState(order.tracking_status || '');
  const { showToast } = useToast();

  const handleTrack = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (tracking) return;
    setTracking(true);
    try {
      const res = await checkOrderShippingStatusAction(order.originalId);
      if (res.success) {
        setStatusText(res.status || '');
        showToast(`📦 ${res.status}${res.statusDate ? ` · ${res.statusDate}` : ''}`, 'success');
      } else {
        showToast(res.error || 'خطأ في التتبع', 'error');
      }
    } catch {
      showToast('فشل الاتصال ببورتال الشحن', 'error');
    } finally {
      setTracking(false);
    }
  };

  // Determine status color
  const getStatusColor = () => {
    const s = statusText.toLowerCase();
    if (s.includes('تسليم') || s.includes('استلم') || s.includes('delivered')) return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
    if (s.includes('جزئي') || s.includes('partial')) return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
    if (s.includes('مرتجع') || s.includes('return')) return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    if (s.includes('مؤجل') || s.includes('postpone')) return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
    if (statusText) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  return (
    <button
      onClick={handleTrack}
      disabled={tracking}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-colors font-medium border text-[11px]",
        statusText ? getStatusColor() : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15",
        tracking && "opacity-50"
      )}
      title={statusText ? `آخر حالة: ${statusText}` : "تتبع الشحنة"}
    >
      {tracking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
      {statusText && <span className="max-w-[80px] lg:max-w-none truncate text-[10px] lg:text-[11px]">{statusText}</span>}
      {!statusText && <span className="hidden lg:inline-block">تتبع</span>}
    </button>
  );
}

export function OrdersTable({ dict, lang, initialOrders, statuses, products }: { dict: any, lang: string, initialOrders?: any[], statuses?: any[], products?: { id: string; sku: string; name: string; price: number }[] }) {
  const safeStatuses = statuses || [
    { id: 'pending', label_ar: 'معلق', label_en: 'Pending', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
  ]

  const getStatus = (value: string) => {
    const s = safeStatuses.find(o => o.id === value || o.value === value) || safeStatuses[0]
    return { label: lang === 'ar' ? s.label_ar : s.label_en, color: s.color }
  }
  const router = useRouter()
  const { showToast } = useToast()
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [dropUp, setDropUp] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [localOrders, setLocalOrders] = useState(initialOrders || [])
  
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [syncOrderId, setSyncOrderId] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isBulkSyncing, setIsBulkSyncing] = useState(false)

  useEffect(() => {
    setLocalOrders(initialOrders || [])
  }, [initialOrders])

  // Realtime subscription — auto-refresh when orders change
  useEffect(() => {
    let mounted = true
    const { createClient } = require('@/lib/supabase/client')
    const supabase = createClient()
    
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // Debounce — wait 500ms then refresh the page to get fresh data
        if (mounted) {
          setTimeout(() => {
            if (mounted) router.refresh()
          }, 500)
        }
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [router])

  const filtered = useMemo(() => {
    return localOrders.filter(o => {
      const matchSearch = !search ||
        o.customer?.toLowerCase().includes(search.toLowerCase()) ||
        o.phone?.includes(search) ||
        o.id?.toLowerCase().includes(search.toLowerCase()) ||
        o.address?.toLowerCase().includes(search.toLowerCase()) ||
        o.waybill_number?.includes(search)
      const matchStatus = filterStatus === 'all' || o.status === filterStatus
      const matchSource = filterSource === 'all' || o.source === filterSource
      return matchSearch && matchStatus && matchSource
    })
  }, [localOrders, search, filterStatus, filterSource])

  const handleDrawerClose = () => {
    setIsManualEntryOpen(false)
    router.refresh()
  }

  const handleSyncOrder = async () => {
    if (!syncOrderId.trim()) return;
    setIsSyncing(true)
    try {
      const trimmed = syncOrderId.trim()
      const res = await syncShopifyOrderAction(trimmed)
      if (res.error) {
        showToast(res.error, 'error')
      } else {
        showToast('تم الجلب بنجاح!', 'success')
        setIsSyncModalOpen(false)
        setSyncOrderId('')
        router.refresh()
      }
    } catch (err: any) {
      showToast('خطأ في الجلب: ' + err.message, 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (originalId: string) => {
    setConfirmDeleteId(null)
    setDeletingId(originalId)
    const result = await deleteOrderAction(originalId)
    setDeletingId(null)
    if (result.success) {
      setLocalOrders(prev => prev.filter(o => o.originalId !== originalId))
      showToast('تم حذف الطلب', 'success')
    } else {
      showToast(`خطأ: ${result.error}`, 'error')
    }
  }

  const toggleStatusMenu = useCallback((e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (statusMenuId === orderId) {
      setStatusMenuId(null)
      setMenuPos(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const shouldDropUp = spaceBelow < 250
    setDropUp(shouldDropUp)
    setMenuPos({
      top: shouldDropUp ? rect.top : rect.bottom + 4,
      left: rect.left,
    })
    setStatusMenuId(orderId)
  }, [statusMenuId])

  // Inline waybill editing
  const [editingWaybillId, setEditingWaybillId] = useState<string | null>(null)
  const [waybillInput, setWaybillInput] = useState('')

  const handleWaybillSave = async (orderId: string) => {
    const trimmed = waybillInput.trim()
    if (!trimmed) { setEditingWaybillId(null); return }
    // Optimistic update
    setLocalOrders(prev => prev.map(o => 
      o.originalId === orderId ? { ...o, waybill_number: trimmed, status: 'shipped' } : o
    ))
    setEditingWaybillId(null)
    showToast('تم حفظ رقم البوليصة — تم الشحن ✓', 'success')
    const result = await saveWaybillAction(orderId, trimmed)
    if (!result.success) {
      showToast(`خطأ: ${result.error}`, 'error')
    }
  }

  const handleStatusChange = async (e: React.MouseEvent, originalId: string, newStatus: string) => {
    e.stopPropagation()
    setStatusMenuId(null)
    setMenuPos(null)
    // Optimistic update — instant UI
    setLocalOrders(prev => prev.map(o => o.originalId === originalId ? { ...o, status: newStatus } : o))
    showToast('تم تحديث الحالة', 'success')
    const result = await updateOrderStatusAction(originalId, newStatus)
    if (!result.success) {
      showToast(`خطأ: ${result.error}`, 'error')
    }
  }

  // Multi-select
  const toggleSelect = (originalId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(originalId)) next.delete(originalId)
      else next.add(originalId)
      return next
    })
  }
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(o => o.originalId)))
  }
  const clearSelection = () => setSelectedIds(new Set())

  const exportToExcel = () => {
    const selectedOrders = filtered.filter(o => selectedIds.has(o.originalId))
    if (selectedOrders.length === 0) return
    const rows = selectedOrders.map(o => ({
      'كود التاجر': `#${String(o.id).replace(/^#/, '')}`,
      'اسم الراسل على البوليصة': 'Vibella',
      'اسم المستلم': o.customer || '',
      'موبايل المستلم': o.phone || '',
      'ملاحظات': o.notes || '',
      'المنطقة': o.address || '',
      'العنوان': o.address || '',
      'محتوى الشحنة': o.notes || '',
      'الكمية': o.quantity || 1,
      'قيمة الشحنة': o.amount || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 15 },
      { wch: 30 }, { wch: 12 }, { wch: 35 }, { wch: 30 },
      { wch: 8 }, { wch: 12 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'شحن')
    XLSX.writeFile(wb, `Vibella_Shipping_${new Date().toISOString().split('T')[0]}.xlsx`)
    clearSelection()
  }

  // Bulk status change
  const [bulkStatusMenu, setBulkStatusMenu] = useState(false)
  const handleBulkStatusChange = async (newStatus: string) => {
    setBulkStatusMenu(false)
    const ids = Array.from(selectedIds)
    // Optimistic update
    setLocalOrders(prev => prev.map(o => ids.includes(o.originalId) ? { ...o, status: newStatus } : o))
    showToast(`تم تحديث ${ids.length} طلب`, 'success')
    // Fire all updates in parallel
    const results = await Promise.allSettled(
      ids.map(id => updateOrderStatusAction(id, newStatus))
    )
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
    if (failed.length > 0) {
      showToast(`فشل تحديث ${failed.length} طلب`, 'error')
    }
    clearSelection()
  }

  return (
    <div className="space-y-4">
      {/* Large Title — iOS style */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="ios-large-title text-foreground">{dict.orders?.title || 'الطلبات'}</h1>
          <p className="ios-subheadline text-muted-foreground mt-0.5">{filtered.length} {lang === 'ar' ? 'طلب' : 'orders'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={async () => {
              if (isBulkSyncing) return;
              setIsBulkSyncing(true);
              try {
                const res = await syncShippingStatusesAction();
                if (res.success) {
                  showToast(`تم تحديث ${res.updated} شحنة من ${res.scanned}`, 'success');
                  router.refresh();
                } else {
                  showToast(res.error || 'خطأ', 'error');
                }
              } catch { showToast('فشل الاتصال', 'error'); }
              finally { setIsBulkSyncing(false); }
            }}
            disabled={isBulkSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full active:bg-amber-500/15 transition-colors text-[13px] font-semibold disabled:opacity-50"
          >
            {isBulkSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            <span className="hidden sm:inline">الشحنات</span>
          </button>
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#34C759]/10 text-[#30B24A] rounded-full active:bg-[#34C759]/20 transition-colors text-[13px] font-semibold"
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">شوبيفاي</span>
          </button>
          <button
            onClick={() => setIsManualEntryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-full active:bg-primary/90 transition-colors text-[13px] font-semibold"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            <span>{dict.orders?.addOrder || 'إضافة طلب'}</span>
          </button>
        </div>
      </div>

      {/* iOS Search Field */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'ar' ? 'ابحث بالاسم أو الهاتف...' : 'Search...'}
          className="w-full bg-muted/80 border-none rounded-[10px] py-2 pr-10 pl-3 focus:outline-none focus:ring-2 focus:ring-primary/25 text-[15px] placeholder:text-muted-foreground"
        />
      </div>

      {/* iOS Segmented Control — Status */}
      <div className="flex gap-1 p-0.5 bg-accent/60 rounded-[9px] overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterStatus('all')}
          className={cn(
            "flex-shrink-0 px-3 py-1 rounded-[7px] text-[13px] font-semibold transition-all whitespace-nowrap",
            filterStatus === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          {lang === 'ar' ? 'الكل' : 'All'}
        </button>
        {safeStatuses.map(s => {
          const val = s.id || s.value
          return (
            <button key={val}
              onClick={() => setFilterStatus(val)}
              className={cn(
                "flex-shrink-0 px-3 py-1 rounded-[7px] text-[13px] font-semibold transition-all whitespace-nowrap",
                filterStatus === val ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {lang === 'ar' ? s.label_ar : s.label_en}
            </button>
          )
        })}
      </div>

      {/* Source filter — compact chip row */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
        {['all', 'facebook', 'instagram', 'shopify', 'manual'].map(src => (
          <button key={src}
            onClick={() => setFilterSource(src)}
            className={cn(
              "flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium border transition-all whitespace-nowrap",
              filterSource === src
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-muted-foreground border-border'
            )}
          >
            {src === 'all' ? (lang === 'ar' ? 'كل المصادر' : 'All Sources')
              : src === 'manual' ? (lang === 'ar' ? 'يدوي' : 'Manual')
              : src.charAt(0).toUpperCase() + src.slice(1)}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="px-3 py-3 w-10">
                  <button onClick={toggleAll} className="p-1 rounded hover:bg-accent transition-colors">
                    {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </th>
                <th className="px-3 py-3 font-medium text-right">{lang === 'ar' ? 'رقم الطلب' : 'Order #'}</th>
                <th className="px-3 py-3 font-medium text-right">{lang === 'ar' ? 'العميل' : 'Customer'}</th>
                <th className="px-3 py-3 font-medium text-right">{lang === 'ar' ? 'التفاصيل' : 'Details'}</th>
                <th className="px-3 py-3 font-medium text-right">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th className="px-3 py-3 font-medium text-right">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-3 py-3 font-medium text-right">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-3 py-3 font-medium text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">{search || filterStatus !== 'all' ? (lang === 'ar' ? 'لا توجد نتائج' : 'No results') : (lang === 'ar' ? 'لا توجد طلبات' : 'No orders yet')}</p>
                  </td>
                </tr>
              ) : filtered.map((order, rowIndex) => {
                const { label: statusLabel, color: statusColor } = getStatus(order.status)
                return (
                  <tr key={order.originalId}
                    className={cn("hover:bg-muted/30 transition-colors", deletingId === order.originalId && "opacity-40")}>
                    <td className="px-3 py-3 w-10">
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(order.originalId) }} className="p-1 rounded hover:bg-accent transition-colors">
                        {selectedIds.has(order.originalId) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-mono text-sm font-semibold text-primary" dir="ltr">#{String(order.id).replace(/^#/, '')}</span>
                        {order.source?.toLowerCase() === 'shopify' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            <Package className="w-2.5 h-2.5" /> Shopify
                          </span>
                        )}
                        {/* Waybill badge / inline input */}
                        {editingWaybillId === order.originalId ? (
                          <input
                            autoFocus
                            type="text"
                            value={waybillInput}
                            onChange={e => setWaybillInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleWaybillSave(order.originalId); if (e.key === 'Escape') setEditingWaybillId(null) }}
                            onBlur={() => handleWaybillSave(order.originalId)}
                            placeholder="رقم البوليصة"
                            className="w-24 px-1.5 py-0.5 text-[10px] border border-primary/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                            dir="ltr"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : order.waybill_number ? (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingWaybillId(order.originalId); setWaybillInput(order.waybill_number) }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                            dir="ltr"
                          >
                            <Truck className="w-2.5 h-2.5" /> {order.waybill_number}
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingWaybillId(order.originalId); setWaybillInput('') }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-muted-foreground/30 transition-colors"
                          >
                            <Truck className="w-2.5 h-2.5" /> {lang === 'ar' ? '+ بوليصة' : '+ Waybill'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground text-sm">{order.customer}</p>
                      {order.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 flex-shrink-0" /> {order.address}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                        <Phone className="w-3 h-3 flex-shrink-0" /> {order.phone || '-'}
                      </p>
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      {order.product ? (
                        <div className="flex items-start gap-1.5">
                          <Package className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/70" />
                          <p className="text-xs text-foreground font-medium leading-relaxed line-clamp-2">{order.product}</p>
                        </div>
                      ) : order.notes ? (
                        <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">{order.notes}</p>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-sm">{Number(order.amount).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground mr-1">ج.م</span>
                    </td>
                    <td className="px-3 py-3 relative">
                      <button
                        onClick={e => toggleStatusMenu(e, order.originalId)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1 ${statusColor}`}
                      >
                        {statusLabel}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {statusMenuId === order.originalId && menuPos && (
                        <>
                          <div className="fixed inset-0 z-[100]" onClick={() => { setStatusMenuId(null); setMenuPos(null) }} />
                          <div
                            className="fixed bg-card border border-border rounded-xl shadow-lg z-[101] overflow-hidden min-w-[130px]"
                            style={dropUp
                              ? { bottom: `${window.innerHeight - menuPos.top + 4}px`, left: `${menuPos.left}px` }
                              : { top: `${menuPos.top}px`, left: `${menuPos.left}px` }
                            }
                          >
                            {safeStatuses.map(s => {
                              const val = s.id || s.value;
                              return (
                              <button key={val}
                                onClick={e => handleStatusChange(e, order.originalId, val)}
                                className={`block w-full text-right px-3 py-2 text-xs hover:bg-muted transition-colors ${order.status === val ? 'bg-muted font-bold text-primary' : 'text-foreground'}`}
                              >
                                {lang === 'ar' ? s.label_ar : s.label_en}
                              </button>
                            )})
                            }
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" /> {order.date}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.time}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                    <WhatsAppLink order={order} />
                    <ShippingCopyButton order={order} />
                    <TrackingButton order={order} />
                        <button onClick={() => setSelectedOrder(order)}
                          className="p-2 rounded-xl bg-muted hover:bg-blue-500/10 hover:text-blue-500 text-muted-foreground transition-colors"
                          title={lang === 'ar' ? 'عرض وتعديل' : 'View & Edit'}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === order.originalId ? (
                          <div className="flex items-center gap-1">
                            <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                              className="px-2 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:bg-border">x</button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(order.originalId) }}
                              disabled={deletingId === order.originalId}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                              {deletingId === order.originalId ? '...' : (lang === 'ar' ? 'متأكد؟' : 'Sure?')}
                            </button>
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(order.originalId) }}
                            disabled={deletingId === order.originalId}
                            className="p-2 rounded-xl bg-muted hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile — iOS grouped list */}
      <div className="md:hidden pb-4">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-[14px] p-10 text-center text-muted-foreground">
             <Package className="w-9 h-9 mx-auto mb-2 opacity-20" />
             <p className="ios-subheadline">{search || filterStatus !== 'all' ? (lang === 'ar' ? 'لا توجد نتائج' : 'No results') : (lang === 'ar' ? 'لا توجد طلبات' : 'No orders yet')}</p>
          </div>
        ) : (
          <div className="bg-card rounded-[14px] overflow-hidden">
            {filtered.map((order, idx) => {
              const { label: statusLabel, color: statusColor } = getStatus(order.status)
              const isLast = idx === filtered.length - 1
              return (
                <div key={order.originalId}
                  className={cn("relative transition-opacity", deletingId === order.originalId && "opacity-40")}
                >
                  <div
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-3 px-4 py-3 active:bg-accent/40 transition-colors cursor-pointer"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(order.originalId) }}
                      className="p-0.5 flex-shrink-0"
                    >
                      {selectedIds.has(order.originalId)
                        ? <CheckSquare className="w-[22px] h-[22px] text-primary" />
                        : <Square className="w-[22px] h-[22px] text-muted-foreground/40" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="ios-body font-semibold text-foreground truncate">{order.customer || (lang === 'ar' ? 'غير مسجل' : 'Unnamed')}</span>
                        {order.source?.toLowerCase() === 'shopify' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#30B24A]/10 text-[#30B24A] flex-shrink-0">Shopify</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ios-footnote text-muted-foreground">
                        <span className="font-mono text-primary" dir="ltr">#{String(order.id).replace(/^#/, '')}</span>
                        <span>·</span>
                        <span className="font-mono" dir="ltr">{order.phone || '-'}</span>
                      </div>
                      {order.product && (
                        <div className="flex items-start gap-1.5 ios-footnote text-foreground/80 mt-0.5">
                          <Package className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/70" />
                          <span className="line-clamp-1 font-medium">{order.product}</span>
                        </div>
                      )}
                      {/* Waybill badge / inline input — mobile */}
                      <div className="mt-0.5">
                        {editingWaybillId === order.originalId ? (
                          <input
                            autoFocus
                            type="text"
                            value={waybillInput}
                            onChange={e => setWaybillInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleWaybillSave(order.originalId); if (e.key === 'Escape') setEditingWaybillId(null) }}
                            onBlur={() => handleWaybillSave(order.originalId)}
                            placeholder="رقم البوليصة"
                            className="w-28 px-2 py-0.5 text-[11px] border border-primary/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-card"
                            dir="ltr"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : order.waybill_number ? (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingWaybillId(order.originalId); setWaybillInput(order.waybill_number) }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 active:bg-purple-100"
                            dir="ltr"
                          >
                            <Truck className="w-2.5 h-2.5" /> {order.waybill_number}
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingWaybillId(order.originalId); setWaybillInput('') }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground border border-dashed border-muted-foreground/30 active:bg-primary/5"
                          >
                            <Truck className="w-2.5 h-2.5" /> {lang === 'ar' ? '+ بوليصة' : '+ Waybill'}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ios-caption text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{order.date} {order.time}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="ios-body font-semibold text-foreground">
                        {order.amount.toLocaleString()} <span className="ios-caption text-muted-foreground">ج.م</span>
                      </span>
                      <button
                        onClick={e => toggleStatusMenu(e, order.originalId)}
                        className={cn("flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border", statusColor)}
                      >
                        {statusLabel}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Status dropdown */}
                  {statusMenuId === order.originalId && menuPos && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => { setStatusMenuId(null); setMenuPos(null) }} />
                      <div
                        className="fixed z-[101] w-36 bg-card border border-border rounded-[10px] shadow-xl overflow-hidden"
                        style={dropUp
                          ? { bottom: `${window.innerHeight - menuPos.top + 4}px`, left: `${menuPos.left}px` }
                          : { top: `${menuPos.top}px`, left: `${menuPos.left}px` }
                        }
                      >
                        {safeStatuses.map(s => {
                          const val = s.id || s.value;
                          return (
                            <button key={val}
                              onClick={e => { e.stopPropagation(); handleStatusChange(e, order.originalId, val); }}
                              className={cn("w-full text-right px-3 py-2 text-[13px] active:bg-accent transition-colors",
                                order.status === val ? 'font-semibold text-primary' : 'text-foreground'
                              )}
                            >
                              {lang === 'ar' ? s.label_ar : s.label_en}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Row actions */}
                  <div className="flex items-center gap-1 px-4 pb-3 -mt-1">
                    <WhatsAppLink order={order} />
                    <ShippingCopyButton order={order} />
                    <TrackingButton order={order} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                      className="p-1.5 rounded-full active:bg-accent text-primary transition-colors"
                    >
                      <Edit3 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    </button>
                    <div className="flex-1" />
                    {confirmDeleteId === order.originalId ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                          className="px-3 py-1 rounded-full bg-accent text-[12px] font-semibold text-muted-foreground">
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(order.originalId) }}
                          disabled={deletingId === order.originalId}
                          className="px-3 py-1 rounded-full bg-[#FF3B30] text-white text-[12px] font-semibold active:bg-[#D70015] disabled:opacity-50">
                          {deletingId === order.originalId ? '...' : (lang === 'ar' ? 'حذف' : 'Delete')}
                        </button>
                      </div>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(order.originalId) }}
                        disabled={deletingId === order.originalId}
                        className="p-1.5 rounded-full active:bg-accent text-[#FF3B30] transition-colors disabled:opacity-50">
                        <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                      </button>
                    )}
                  </div>

                  {!isLast && <div className="h-px bg-border mx-4" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ManualEntryDrawer isOpen={isManualEntryOpen} onClose={handleDrawerClose} dict={dict} lang={lang} products={products} />
      <OrderDetailsDrawer order={selectedOrder} isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} lang={lang} statuses={safeStatuses} />

      {/* Floating Selection Bar — iOS pill */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 ios-blur rounded-full pl-4 pr-1.5 py-1.5 shadow-xl border border-border/60">
          <span className="ios-footnote font-semibold text-foreground whitespace-nowrap">
            {selectedIds.size} {lang === 'ar' ? 'محدد' : 'selected'}
          </span>
          {/* Bulk Status Change */}
          <div className="relative">
            <button onClick={() => setBulkStatusMenu(!bulkStatusMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[13px] font-semibold rounded-full active:bg-amber-600 transition-colors">
              <ChevronDown className="w-4 h-4" />
              {lang === 'ar' ? 'تغيير الحالة' : 'Status'}
            </button>
            {bulkStatusMenu && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setBulkStatusMenu(false)} />
                <div className="absolute bottom-full mb-2 right-0 w-40 bg-card border border-border rounded-[10px] shadow-xl overflow-hidden z-[101]">
                  {safeStatuses.map(s => {
                    const val = s.id || s.value;
                    return (
                      <button key={val}
                        onClick={() => handleBulkStatusChange(val)}
                        className="w-full text-right px-3 py-2 text-[13px] hover:bg-muted active:bg-accent transition-colors text-foreground"
                      >
                        {lang === 'ar' ? s.label_ar : s.label_en}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <button onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[13px] font-semibold rounded-full active:bg-primary/90 transition-colors">
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button onClick={clearSelection}
            className="px-2 py-1.5 text-[13px] font-semibold text-muted-foreground active:text-foreground transition-colors">
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Sync Modal — iOS alert style */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-md">
          <div className="bg-card/95 backdrop-blur-xl rounded-[14px] w-full max-w-[280px] shadow-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#30B24A]/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-[#30B24A]" />
              </div>
              <h3 className="ios-headline text-foreground mb-1">{lang === 'ar' ? 'جلب طلب من Shopify' : 'Sync Shopify Order'}</h3>
              <p className="ios-footnote text-muted-foreground">{lang === 'ar' ? 'أدخل رقم الطلب' : 'Enter order number'}</p>
              <input
                type="text"
                value={syncOrderId}
                onChange={(e) => setSyncOrderId(e.target.value)}
                placeholder="#1284"
                className="w-full bg-muted rounded-[10px] px-3 py-2 text-[15px] mt-3 focus:outline-none focus:ring-2 focus:ring-primary/25 text-center"
                dir="ltr"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 border-t border-border">
              <button onClick={() => setIsSyncModalOpen(false)}
                disabled={isSyncing}
                className="py-2.5 ios-body text-primary active:bg-accent/60 transition-colors border-l border-border disabled:opacity-50">
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSyncOrder}
                disabled={isSyncing || !syncOrderId.trim()}
                className="py-2.5 ios-body font-semibold text-primary active:bg-accent/60 transition-colors disabled:opacity-40">
                {isSyncing ? '...' : (lang === 'ar' ? 'جلب' : 'Sync')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
