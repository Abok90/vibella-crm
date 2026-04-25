'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  DollarSign,
  Package,
  Percent,
  ShoppingBag,
  TrendingUp,
  Truck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RevenueChart } from './revenue-chart'

/* ─── Types ─── */
type Order = {
  id: string
  total: number
  status: string
  source: string
  created_at: string | null
  date: string | null
  productAmount: number
  shippingAmount: number
  costAmount: number
  productCount: number
}

type Status = { id: string; label_ar: string; label_en: string; color: string }
type Preset = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom'

/* ─── Date helpers ─── */
function fmtLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() { return fmtLocalDate(new Date()) }
function addDays(base: Date, days: number) { const d = new Date(base); d.setDate(d.getDate() + days); return d }
function rangeFor(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const today = fmtLocalDate(now)
  if (preset === 'today') return { from: today, to: today }
  if (preset === '7d') return { from: fmtLocalDate(addDays(now, -6)), to: today }
  if (preset === '30d') return { from: fmtLocalDate(addDays(now, -29)), to: today }
  if (preset === 'month') return { from: fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null }
  return { from: null, to: null }
}
function inRange(date: string | null, from: string | null, to: string | null) {
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

/* ─── Component ─── */
export function DashboardView({
  dict, lang, orders, statuses, lowStockCount,
}: {
  dict: any; lang: string; orders: Order[]; statuses: Status[]; lowStockCount: number
}) {
  const isRTL = lang === 'ar'
  const router = useRouter()
  const [preset, setPreset] = useState<Preset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(todayStr())
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null)

  // Realtime sync
  useEffect(() => {
    let mounted = true; let timer: ReturnType<typeof setTimeout>
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const ch = sb.channel('dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (!mounted) return; clearTimeout(timer); timer = setTimeout(() => router.refresh(), 500) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { if (!mounted) return; clearTimeout(timer); timer = setTimeout(() => router.refresh(), 500) })
      .subscribe()
    return () => { mounted = false; clearTimeout(timer); sb.removeChannel(ch) }
  }, [router])

  const { from, to } = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo])
  const filtered = useMemo(() => !from && !to ? orders : orders.filter(o => inRange(o.date, from, to)), [orders, from, to])

  /* ────────────────────────────
   * ACCOUNTING — P&L Summary
   * ──────────────────────────── */
  const pnl = useMemo(() => {
    const delivered = filtered.filter(o => o.status === 'delivered')
    const cancelled = filtered.filter(o => o.status === 'cancelled')
    const returned = filtered.filter(o => o.status === 'returned')

    // 1. Gross Sales — total of all delivered orders (what customer paid)
    const grossSales = delivered.reduce((s, o) => s + o.total, 0)

    // 2. Shipping collected — shipping portion of delivered orders
    const shippingCollected = delivered.reduce((s, o) => s + o.shippingAmount, 0)

    // 3. Net Sales — gross sales minus shipping (product value only)
    const netSales = grossSales - shippingCollected

    // 4. COGS — Cost of Goods Sold (product cost_price matched from inventory)
    const cogs = delivered.reduce((s, o) => s + o.costAmount, 0)

    // 5. Gross Profit = Net Sales - COGS
    const grossProfit = netSales - cogs

    // 6. Gross Margin %
    const grossMargin = netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0

    // 7. Totals for context
    const totalOrders = filtered.length
    const deliveredCount = delivered.length
    const cancelledTotal = cancelled.reduce((s, o) => s + o.total, 0)
    const returnedTotal = returned.reduce((s, o) => s + o.total, 0)

    return {
      grossSales,
      shippingCollected,
      netSales,
      cogs,
      grossProfit,
      grossMargin,
      totalOrders,
      deliveredCount,
      cancelledTotal,
      returnedTotal,
    }
  }, [filtered])

  const perStatus = useMemo(() => {
    const byId: Record<string, { count: number; total: number; costAmount: number; productAmount: number; shippingAmount: number }> = {}
    for (const s of statuses) byId[s.id] = { count: 0, total: 0, costAmount: 0, productAmount: 0, shippingAmount: 0 }
    for (const o of filtered) {
      if (!byId[o.status]) byId[o.status] = { count: 0, total: 0, costAmount: 0, productAmount: 0, shippingAmount: 0 }
      byId[o.status].count += 1
      byId[o.status].total += o.total
      byId[o.status].costAmount += o.costAmount
      byId[o.status].productAmount += o.productAmount
      byId[o.status].shippingAmount += o.shippingAmount
    }
    return byId
  }, [filtered, statuses])

  // 7-day chart
  const chartData = useMemo(() => {
    const map: Record<string, any> = {}
    const end = to ? new Date(to) : new Date()
    const now = new Date()
    const anchor = end > now ? now : end
    for (let i = 6; i >= 0; i--) {
      const d = addDays(anchor, -i)
      const key = fmtLocalDate(d)
      const name = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })
      map[key] = { name, revenue: 0, cogs: 0 }
    }
    for (const o of filtered) {
      if (o.date && map[o.date] && o.status === 'delivered') {
        map[o.date].revenue += o.total
        map[o.date].cogs += o.costAmount
      }
    }
    return Object.values(map)
  }, [filtered, to, lang])

  const presets: { id: Preset; ar: string; en: string }[] = [
    { id: 'today', ar: 'اليوم', en: 'Today' },
    { id: '7d', ar: '7 أيام', en: '7d' },
    { id: '30d', ar: '30 يوم', en: '30d' },
    { id: 'month', ar: 'هذا الشهر', en: 'Month' },
    { id: 'all', ar: 'الكل', en: 'All' },
    { id: 'custom', ar: 'مخصص', en: 'Custom' },
  ]

  const fmt = (n: number) => n.toLocaleString()
  const expandedData = expandedStatus ? perStatus[expandedStatus] : null
  const expandedMeta = statuses.find(s => s.id === expandedStatus)

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Title */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-display text-foreground">{dict.dashboard.title}</h1>
          <p className="ios-subheadline text-muted-foreground mt-0.5">
            {isRTL ? 'قائمة الأرباح والخسائر' : 'P&L Overview'}
          </p>
        </div>
      </div>

      {/* ── Date filter ── */}
      <div className="space-y-2">
        <div className="flex gap-1 p-1 glass rounded-2xl overflow-x-auto no-scrollbar">
          {presets.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={cn('flex-shrink-0 px-3.5 py-1.5 rounded-xl text-[13px] font-semibold transition-all duration-200 whitespace-nowrap',
                preset === p.id ? 'gradient-primary text-white shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground')}
            >
              {isRTL ? p.ar : p.en}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="flex-1 bg-transparent outline-none text-[14px] font-mono" max={customTo || undefined} />
            </div>
            <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="flex-1 bg-transparent outline-none text-[14px] font-mono" min={customFrom || undefined} />
            </div>
          </div>
        )}
        {(from || to) && preset !== 'all' && (
          <p className="ios-caption text-muted-foreground px-1">{isRTL ? 'المدة' : 'Range'}: {from || '—'} → {to || '—'}</p>
        )}
      </div>

      {/* ═══════════════════════════
       *  P&L STATEMENT CARDS
       * ═══════════════════════════ */}

      {/* Row 1: Gross Sales + COGS */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <KpiCard
          icon={<ArrowUpRight className="w-4 h-4" strokeWidth={2.2} />}
          iconBg="bg-[#34C759]/10"
          iconColor="text-[#34C759]"
          label={isRTL ? 'إجمالي المبيعات' : 'Gross Sales'}
          value={`${fmt(pnl.grossSales)}`}
          sub={isRTL ? `${pnl.deliveredCount} طلب تم تسليمه` : `${pnl.deliveredCount} delivered`}
        />
        <KpiCard
          icon={<ArrowDownRight className="w-4 h-4" strokeWidth={2.2} />}
          iconBg="bg-[#FF3B30]/10"
          iconColor="text-[#FF3B30]"
          label={isRTL ? 'تكلفة البضاعة' : 'COGS'}
          value={`${fmt(pnl.cogs)}`}
          sub={isRTL ? 'تكلفة المنتجات المُسلَّمة' : 'Cost of delivered goods'}
        />
      </div>

      {/* Row 2: Gross Profit + Margin + Shipping + Orders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" strokeWidth={2} />}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          label={isRTL ? 'إجمالي الربح' : 'Gross Profit'}
          value={`${fmt(pnl.grossProfit)}`}
          valueColor={pnl.grossProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}
          sub={isRTL ? 'المبيعات − التكلفة − الشحن' : 'Sales − COGS − shipping'}
        />
        <KpiCard
          icon={<Percent className="w-4 h-4" strokeWidth={2} />}
          iconBg="bg-muted"
          iconColor="text-foreground"
          label={isRTL ? 'هامش الربح' : 'Gross Margin'}
          value={`${pnl.grossMargin}%`}
          valueColor={pnl.grossMargin >= 30 ? 'text-[#34C759]' : pnl.grossMargin >= 15 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
          sub={isRTL ? 'الربح ÷ صافي المبيعات' : 'Profit ÷ Net Sales'}
          hideCurrency
        />
        <KpiCard
          icon={<Truck className="w-4 h-4" strokeWidth={2} />}
          iconBg="bg-[#5856D6]/10"
          iconColor="text-[#5856D6]"
          label={isRTL ? 'الشحن المُحصَّل' : 'Shipping'}
          value={`${fmt(pnl.shippingCollected)}`}
          sub={isRTL ? 'من أوردرات التوصيل' : 'From delivered orders'}
        />
        <Link href={`/${lang}/orders`}>
          <KpiCard
            icon={<ShoppingBag className="w-4 h-4" strokeWidth={2} />}
            iconBg="bg-[#AF52DE]/10"
            iconColor="text-[#AF52DE]"
            label={isRTL ? 'إجمالي الطلبات' : 'Total Orders'}
            value={fmt(pnl.totalOrders)}
            clickable
            hideCurrency
          />
        </Link>
      </div>

      {/* Mini P&L breakdown */}
      <div className="glass rounded-2xl p-4 md:p-5 card-elevated">
        <h3 className="ios-headline text-foreground mb-3">{isRTL ? 'قائمة الدخل المختصرة' : 'Income Statement'}</h3>
        <div className="space-y-1.5 text-[14px]">
          <PLRow label={isRTL ? 'إجمالي المبيعات (تم التسليم)' : 'Gross Sales (Delivered)'} value={pnl.grossSales} bold />
          <PLRow label={isRTL ? '− الشحن المُحصَّل' : '− Shipping collected'} value={-pnl.shippingCollected} indent />
          <div className="h-px bg-border my-2" />
          <PLRow label={isRTL ? 'صافي المبيعات' : 'Net Sales'} value={pnl.netSales} bold />
          <PLRow label={isRTL ? '− تكلفة البضاعة المباعة' : '− Cost of Goods Sold'} value={-pnl.cogs} indent color="text-[#FF3B30]" />
          <div className="h-px bg-border my-2" />
          <PLRow label={isRTL ? 'إجمالي الربح' : 'Gross Profit'} value={pnl.grossProfit} bold highlight color={pnl.grossProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'} />
          <PLRow label={isRTL ? 'هامش الربح' : 'Gross Margin'} value={pnl.grossMargin} suffix="%" bold />
          {(pnl.cancelledTotal > 0 || pnl.returnedTotal > 0) && (
            <>
              <div className="h-px bg-border my-2" />
              <p className="ios-caption text-muted-foreground mb-1">{isRTL ? 'فاقد (لا يؤثر على الربح)' : 'Losses (excluded from profit)'}</p>
              {pnl.cancelledTotal > 0 && <PLRow label={isRTL ? 'ملغي' : 'Cancelled'} value={pnl.cancelledTotal} color="text-muted-foreground" indent />}
              {pnl.returnedTotal > 0 && <PLRow label={isRTL ? 'مرتجع' : 'Returned'} value={pnl.returnedTotal} color="text-muted-foreground" indent />}
            </>
          )}
        </div>
      </div>

      {/* ── Order Status Cards ── */}
      <div>
        <h2 className="ios-headline text-foreground mb-2 px-1">{isRTL ? 'حالات الطلبات' : 'Order statuses'}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {statuses.map(s => {
            const d = perStatus[s.id] || { count: 0, total: 0, costAmount: 0, productAmount: 0, shippingAmount: 0 }
            const isOpen = expandedStatus === s.id
            return (
              <button key={s.id} onClick={() => setExpandedStatus(isOpen ? null : s.id)}
                className={cn('text-start glass rounded-2xl p-3 active:scale-[0.98] transition-all duration-200 border',
                  isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-transparent')}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', s.color)}>
                    {isRTL ? s.label_ar : s.label_en}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform flex-shrink-0', isOpen && 'rotate-180')} />
                </div>
                <p className="text-[22px] font-bold text-foreground font-mono leading-none">{d.count}</p>
                <p className="ios-caption text-muted-foreground mt-1">{fmt(d.total)} <span className="opacity-70">EGP</span></p>
              </button>
            )
          })}
        </div>
        {expandedData && expandedMeta && (
          <div className="mt-3 glass rounded-2xl p-4 border border-primary/20 glow-primary">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border', expandedMeta.color)}>
                  {isRTL ? expandedMeta.label_ar : expandedMeta.label_en}
                </span>
              </div>
              <button onClick={() => setExpandedStatus(null)} className="p-1 rounded-full text-muted-foreground active:bg-accent"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailStat icon={<ShoppingBag className="w-4 h-4" />} label={isRTL ? 'عدد الطلبات' : 'Orders'} value={fmt(expandedData.count)} tint="purple" />
              <DetailStat icon={<DollarSign className="w-4 h-4" />} label={isRTL ? 'إجمالي المبلغ' : 'Total amount'} value={`${fmt(expandedData.total)} EGP`} tint="blue" />
              <DetailStat icon={<Package className="w-4 h-4" />} label={isRTL ? 'تكلفة البضاعة' : 'COGS'} value={`${fmt(expandedData.costAmount)} EGP`} tint="amber" />
              <DetailStat icon={<TrendingUp className="w-4 h-4" />} label={isRTL ? 'الربح' : 'Profit'} value={`${fmt(expandedData.total - expandedData.costAmount - expandedData.shippingAmount)} EGP`} tint="green" />
            </div>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2">
          <RevenueChart dict={dict} lang={lang} data={chartData} />
        </div>
        <div className="glass rounded-2xl p-5 md:p-6 flex flex-col justify-center items-center text-center card-elevated">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-[6px] border-accent flex items-center justify-center mb-4 relative">
            <div className={cn('absolute inset-0 rounded-full border-[6px] border-transparent rotate-45',
              pnl.grossMargin >= 0 ? 'border-t-primary border-r-primary' : 'border-t-[#FF3B30] border-r-[#FF3B30]')} />
            <span className="ios-large-title text-foreground">{pnl.grossMargin}%</span>
          </div>
          <h3 className="ios-headline text-foreground mb-1">{dict.dashboard.netProfitMargin}</h3>
          <p className="ios-footnote text-muted-foreground leading-relaxed max-w-[250px]">
            {isRTL ? 'إجمالي الربح ÷ صافي المبيعات' : 'Gross Profit ÷ Net Sales'}
          </p>
          <Link href={`/${lang}/inventory`} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#FF9500] font-semibold active:opacity-70">
            <Package className="w-3.5 h-3.5" />
            {isRTL ? `${lowStockCount} منخفض المخزون` : `${lowStockCount} Low stock`}
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function KpiCard({ icon, iconBg, iconColor, label, value, sub, valueColor, clickable, hideCurrency }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; sub?: string; valueColor?: string; clickable?: boolean; hideCurrency?: boolean
}) {
  return (
    <div className={cn('glass rounded-2xl p-4 h-full card-elevated transition-all duration-200', clickable && 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer')}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        <p className="ios-footnote text-muted-foreground truncate font-medium">{label}</p>
      </div>
      <p className={cn('text-xl font-bold tracking-tight break-all', valueColor || 'text-foreground')}>
        {value} {!hideCurrency && <span className="text-[12px] text-muted-foreground font-medium">EGP</span>}
      </p>
      {sub && <p className="ios-caption text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function PLRow({ label, value, bold, indent, color, highlight, suffix }: {
  label: string; value: number; bold?: boolean; indent?: boolean; color?: string; highlight?: boolean; suffix?: string
}) {
  const display = suffix ? `${value}${suffix}` : `${value < 0 ? '(' : ''}${Math.abs(value).toLocaleString()}${value < 0 ? ')' : ''}`
  return (
    <div className={cn('flex items-center justify-between gap-2 py-1', indent && 'pl-4', highlight && 'bg-primary/5 dark:bg-primary/10 -mx-2 px-2 rounded-xl py-2')}>
      <span className={cn('text-[13px]', bold ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('text-[13px] font-mono tabular-nums', bold ? 'font-bold' : 'font-medium', color || (bold ? 'text-foreground' : 'text-muted-foreground'))}>
        {display} {!suffix && <span className="text-[11px] opacity-50">EGP</span>}
      </span>
    </div>
  )
}

function DetailStat({ icon, label, value, tint }: {
  icon: React.ReactNode; label: string; value: string; tint: 'purple' | 'blue' | 'amber' | 'green'
}) {
  const palette = {
    purple: 'bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400',
    blue: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    green: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  } as const
  return (
    <div className="glass rounded-xl p-3">
      <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', palette[tint])}>
        {icon}<span>{label}</span>
      </div>
      <p className="mt-1.5 text-[17px] font-bold text-foreground font-mono leading-tight break-all">{value}</p>
    </div>
  )
}
