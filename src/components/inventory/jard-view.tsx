'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ProductRow = {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  reserved_pending: number
  reserved_confirmed: number
  reserved: number
  remaining: number
  status: 'ok' | 'tight' | 'short'
  orders: { id: string; status: string; qty: number }[]
}

type UnknownRow = { label: string; reserved: number; orders: string[] }

export function JardView({
  dict,
  lang,
  products,
  unknowns,
}: {
  dict: any
  lang: string
  products: ProductRow[]
  unknowns: UnknownRow[]
}) {
  const isRTL = lang === 'ar'
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'reserved' | 'short'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const totals = useMemo(() => {
    const short = products.filter((p) => p.status === 'short').length
    const tight = products.filter((p) => p.status === 'tight').length
    const pending = products.reduce((a, p) => a + p.reserved_pending, 0)
    const confirmed = products.reduce((a, p) => a + p.reserved_confirmed, 0)
    return { short, tight, pending, confirmed, missing: unknowns.length }
  }, [products, unknowns])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.name?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false
      }
      if (filter === 'reserved' && p.reserved === 0) return false
      if (filter === 'short' && p.status !== 'short') return false
      return true
    })
  }, [products, search, filter])

  const filteredUnknowns = useMemo(() => {
    if (!search) return unknowns
    const q = search.toLowerCase()
    return unknowns.filter((u) => u.label.toLowerCase().includes(q))
  }, [unknowns, search])

  const Chevron = isRTL ? ChevronLeft : ChevronRight

  const statusPill = (s: ProductRow['status']) => {
    if (s === 'short') return 'bg-[#FF3B30]/10 text-[#FF3B30]'
    if (s === 'tight') return 'bg-[#FF9500]/10 text-[#FF9500]'
    return 'bg-[#34C759]/10 text-[#34C759]'
  }
  const statusLabel = (s: ProductRow['status']) => {
    if (s === 'short') return isRTL ? 'عجز' : 'Short'
    if (s === 'tight') return isRTL ? 'منخفض' : 'Tight'
    return isRTL ? 'كافي' : 'OK'
  }

  return (
    <div className="space-y-4">
      {/* Title + back to inventory */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="ios-large-title text-foreground truncate">
            {isRTL ? 'جرد المخزون' : 'Stock Audit'}
          </h1>
          <p className="ios-subheadline text-muted-foreground mt-0.5">
            {isRTL
              ? 'قيد المراجعة + المؤكدة'
              : 'Pending + confirmed reservations'}
          </p>
        </div>
        <Link
          href={`/${lang}/inventory`}
          className="flex items-center gap-1 px-3 py-2 bg-accent/70 text-foreground rounded-full active:bg-accent transition-colors text-[13px] font-semibold flex-shrink-0"
        >
          <Chevron className="w-4 h-4" />
          <span>{isRTL ? 'المنتجات' : 'Products'}</span>
        </Link>
      </div>

      {/* KPI row — compact cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label={isRTL ? 'قيد المراجعة' : 'Pending'}
          value={totals.pending}
          tint="amber"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label={isRTL ? 'مؤكد' : 'Confirmed'}
          value={totals.confirmed}
          tint="blue"
        />
        <KpiCard
          icon={<AlertCircle className="w-4 h-4" />}
          label={isRTL ? 'عجز' : 'Shortage'}
          value={totals.short}
          tint="red"
        />
        <KpiCard
          icon={<Package className="w-4 h-4" />}
          label={isRTL ? 'غير مسجل' : 'Unlisted'}
          value={totals.missing}
          tint="gray"
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground',
            isRTL ? 'right-3' : 'left-3',
          )}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRTL ? 'اسم المنتج أو SKU...' : 'Product name or SKU...'}
          className={cn(
            'w-full bg-muted/80 border-none rounded-[10px] py-2 focus:outline-none focus:ring-2 focus:ring-primary/25 text-[15px] placeholder:text-muted-foreground',
            isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3',
          )}
        />
      </div>

      {/* Segmented filter */}
      <div className="flex gap-0.5 p-0.5 bg-accent/60 rounded-[9px]">
        {([
          { id: 'all', ar: 'الكل', en: 'All' },
          { id: 'reserved', ar: 'محجوز', en: 'Reserved' },
          { id: 'short', ar: 'عجز', en: 'Shortage' },
        ] as const).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={cn(
              'flex-1 py-1 text-[13px] font-semibold rounded-[7px] transition-all',
              filter === opt.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {isRTL ? opt.ar : opt.en}
          </button>
        ))}
      </div>

      {/* Products list */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-[14px] p-10 text-center">
          <Package className="w-9 h-9 mx-auto mb-2 opacity-20" />
          <p className="ios-subheadline text-muted-foreground">
            {isRTL ? 'لا توجد منتجات' : 'No products'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-[14px] overflow-hidden">
          {filtered.map((p, idx) => {
            const isLast = idx === filtered.length - 1 && filteredUnknowns.length === 0
            const isOpen = expandedId === p.id
            return (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="w-full text-start flex items-center gap-3 px-4 py-3 active:bg-accent/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="ios-body font-semibold text-foreground truncate">{p.name}</p>
                    <div className="flex items-center gap-2 ios-caption text-muted-foreground mt-0.5 flex-wrap">
                      <span className="font-mono">{p.sku}</span>
                      <span>·</span>
                      <span>
                        {isRTL ? 'المخزون' : 'Stock'}:{' '}
                        <span className="font-semibold text-foreground">{p.stock}</span>
                      </span>
                      <span>·</span>
                      <span>
                        {isRTL ? 'محجوز' : 'Reserved'}:{' '}
                        <span className="font-semibold text-foreground">{p.reserved}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={cn(
                        'ios-body font-mono font-semibold',
                        p.remaining < 0
                          ? 'text-[#FF3B30]'
                          : p.remaining <= 2
                            ? 'text-[#FF9500]'
                            : 'text-foreground',
                      )}
                    >
                      {p.remaining}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                        statusPill(p.status),
                      )}
                    >
                      {statusLabel(p.status)}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform flex-shrink-0',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-3 -mt-1 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat
                        label={isRTL ? 'مخزون' : 'Stock'}
                        value={p.stock}
                        tone="neutral"
                      />
                      <MiniStat
                        label={isRTL ? 'قيد المراجعة' : 'Pending'}
                        value={p.reserved_pending}
                        tone="amber"
                      />
                      <MiniStat
                        label={isRTL ? 'مؤكد' : 'Confirmed'}
                        value={p.reserved_confirmed}
                        tone="blue"
                      />
                    </div>
                    {p.orders.length > 0 ? (
                      <div className="bg-muted/60 rounded-[10px] p-2 space-y-1">
                        <p className="ios-caption text-muted-foreground font-semibold px-1">
                          {isRTL ? 'الطلبات المرتبطة' : 'Linked orders'}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {p.orders.map((o, i) => (
                            <span
                              key={i}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                                o.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                              )}
                            >
                              <span className="font-mono" dir="ltr">
                                #{o.id}
                              </span>
                              {o.qty > 1 && <span>×{o.qty}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="ios-caption text-muted-foreground">
                        {isRTL ? 'لا يوجد حجز حالياً' : 'No current reservations'}
                      </p>
                    )}
                  </div>
                )}

                {!isLast && <div className="h-px bg-border mx-4" />}
              </div>
            )
          })}
        </div>
      )}

      {/* Unknown / unlisted products — negative stock */}
      {filteredUnknowns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 pt-2">
            <AlertCircle className="w-4 h-4 text-[#FF3B30]" />
            <h2 className="ios-headline text-foreground">
              {isRTL ? 'غير مسجلة في المنتجات' : 'Not in catalog'}
            </h2>
            <span className="ios-caption text-muted-foreground">
              ({filteredUnknowns.length})
            </span>
          </div>
          <div className="bg-card rounded-[14px] overflow-hidden border border-[#FF3B30]/20">
            {filteredUnknowns.map((u, idx) => {
              const isLast = idx === filteredUnknowns.length - 1
              return (
                <div key={idx}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-[10px] bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-[#FF3B30]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="ios-body font-semibold text-foreground truncate">{u.label}</p>
                      <div className="flex items-center gap-2 ios-caption text-muted-foreground mt-0.5 flex-wrap">
                        <span>
                          {isRTL ? 'محجوز' : 'Reserved'}:{' '}
                          <span className="font-semibold text-foreground">{u.reserved}</span>
                        </span>
                        <span>·</span>
                        <span>
                          {isRTL ? 'طلبات' : 'Orders'}:{' '}
                          <span className="font-mono" dir="ltr">
                            {u.orders.slice(0, 3).join(', ')}
                            {u.orders.length > 3 ? '…' : ''}
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className="ios-body font-mono font-bold text-[#FF3B30] flex-shrink-0">
                      −{u.reserved}
                    </span>
                  </div>
                  {!isLast && <div className="h-px bg-border mx-4" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tint: 'amber' | 'blue' | 'red' | 'gray'
}) {
  const palette = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    red: 'bg-[#FF3B30]/10 text-[#FF3B30]',
    gray: 'bg-muted text-muted-foreground',
  } as const
  return (
    <div className="bg-card rounded-[12px] p-3">
      <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', palette[tint])}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-[22px] font-bold text-foreground font-mono leading-tight">{value}</p>
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'neutral' | 'amber' | 'blue'
}) {
  const ring =
    tone === 'amber'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : tone === 'blue'
        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
        : 'bg-muted text-foreground'
  return (
    <div className={cn('rounded-[10px] px-2 py-1.5', ring)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[15px] font-bold font-mono leading-tight">{value}</p>
    </div>
  )
}
