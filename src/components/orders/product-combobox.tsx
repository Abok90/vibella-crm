'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, Package, Check } from 'lucide-react'

export interface ProductOption {
  id: string
  sku: string
  name: string
  price: number
}

export function ProductCombobox({
  value,
  onChange,
  lang,
  options,
  onPickPrice,
}: {
  value: string
  onChange: (v: string) => void
  lang: string
  options?: ProductOption[]
  onPickPrice?: (price: number) => void
}) {
  const isRTL = lang === 'ar'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const list = options || []
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return list.slice(0, 12)
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [list, query])

  const pick = (p: ProductOption) => {
    const line = p.name
    const existing = value.trim()
    // Avoid duplicate lines
    const alreadyThere = existing
      .split('\n')
      .some((l) => l.trim().toLowerCase() === line.toLowerCase())
    const next = alreadyThere ? existing : existing ? `${existing}\n${line}` : line
    onChange(next)
    if (p.price && onPickPrice) onPickPrice(p.price)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={isRTL ? 'اكتب أو اختر من القائمة' : 'Type or pick from list'}
        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none text-sm"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors`}
        aria-label="Toggle product list"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-72 flex flex-col`}
        >
          <div className="p-2 border-b border-border">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isRTL ? 'ابحث في المنتجات...' : 'Search products...'}
              className="w-full bg-muted/70 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {list.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Package className="w-5 h-5 mx-auto mb-1 opacity-40" />
                {isRTL ? 'لا توجد منتجات مسجلة' : 'No products yet'}
              </div>
            ) : matches.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {isRTL ? 'لا توجد نتائج' : 'No matches'}
              </div>
            ) : (
              matches.map((p) => {
                const alreadyIn = value
                  .split('\n')
                  .some((l) => l.trim().toLowerCase() === p.name.toLowerCase())
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => pick(p)}
                    className="w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {p.sku}
                        {p.price ? ` · ${p.price} EGP` : ''}
                      </p>
                    </div>
                    {alreadyIn && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
