'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, AlertCircle, Trash2, Image as ImageIcon, Package, ClipboardList } from 'lucide-react'
import { ProductManagerDrawer } from './product-manager-drawer'
import { deleteProductAction, updateCostPriceAction } from '@/app/actions/inventory'
import { syncShopifyInventoryAction } from '@/app/actions/shopify-inventory'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function InventoryTable({ dict, lang, initialProducts }: { dict: any, lang: string, initialProducts?: any[] }) {
  const router = useRouter()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [localProducts, setLocalProducts] = useState(initialProducts || [])
  const [search, setSearch] = useState('')
  const isRTL = lang === 'ar'
  const [editingCostId, setEditingCostId] = useState<string | null>(null)
  const [costInput, setCostInput] = useState('')

  const [isSyncOpen, setIsSyncOpen] = useState(false)
  const [syncMode, setSyncMode] = useState<'single' | 'all'>('single')
  const [syncQuery, setSyncQuery] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => { setLocalProducts(initialProducts || []) }, [initialProducts])

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
    router.refresh()
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await syncShopifyInventoryAction({ mode: syncMode, productIdOrName: syncMode === 'single' ? syncQuery : undefined })
      if (res.error) alert(res.error)
      else {
        alert(res.message)
        setIsSyncOpen(false)
        setSyncQuery('')
        router.refresh()
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null)
    setDeletingId(id)
    const result = await deleteProductAction(id)
    setDeletingId(null)
    if (result.success) {
      setLocalProducts(prev => prev.filter(p => p.id !== id))
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  const filtered = localProducts.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCostSave = async (productId: string) => {
    const val = parseFloat(costInput)
    if (isNaN(val) || val < 0) { setEditingCostId(null); return }
    setLocalProducts(prev => prev.map(p => p.id === productId ? { ...p, costPrice: val, cost: `EGP ${val}` } : p))
    setEditingCostId(null)
    await updateCostPriceAction(productId, val)
  }

  const statusBadge = (status: string) => {
    if (status === 'inStock') return 'bg-[#34C759]/10 text-[#34C759]'
    if (status === 'lowStock') return 'bg-[#FF9500]/10 text-[#FF9500]'
    return 'bg-[#FF3B30]/10 text-[#FF3B30]'
  }

  return (
    <div className="space-y-4">
      {/* Large title */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="ios-large-title text-foreground">{dict.inventory.title}</h1>
          <p className="ios-subheadline text-muted-foreground mt-0.5">
            {filtered.length} {isRTL ? 'منتج' : 'products'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/${lang}/inventory/jard`}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FF9500]/10 text-[#FF9500] rounded-full active:bg-[#FF9500]/20 transition-colors text-[13px] font-semibold"
          >
            <ClipboardList className="w-4 h-4" />
            <span>{isRTL ? 'جرد' : 'Audit'}</span>
          </Link>
          <button
            onClick={() => setIsSyncOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#34C759]/10 text-[#30B24A] rounded-full active:bg-[#34C759]/20 transition-colors text-[13px] font-semibold"
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Shopify</span>
          </button>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-full active:bg-primary/90 transition-colors text-[13px] font-semibold"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            <span>{dict.inventory.addProduct}</span>
          </button>
        </div>
      </div>

      {/* iOS search */}
      <div className="relative">
        <Search className={cn("absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground", isRTL ? 'right-3' : 'left-3')} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={dict.inventory.search}
          className={cn("w-full bg-muted/80 border-none rounded-[10px] py-2 focus:outline-none focus:ring-2 focus:ring-primary/25 text-[15px] placeholder:text-muted-foreground",
            isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'
          )}
        />
      </div>

      {/* iOS grouped list */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-[14px] p-10 text-center">
          <Package className="w-9 h-9 mx-auto mb-2 opacity-20" />
          <p className="ios-subheadline text-muted-foreground">{lang === 'ar' ? 'لا توجد منتجات' : 'No products yet'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-[14px] overflow-hidden">
          {filtered.map((p, idx) => {
            const isLast = idx === filtered.length - 1
            return (
              <div key={p.id} className={cn("transition-opacity", deletingId === p.id && "opacity-40")}>
                <div className="flex items-center gap-3 px-4 py-3 active:bg-accent/40 transition-colors">
                  <div className="w-12 h-12 rounded-[10px] bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="ios-body font-semibold text-foreground truncate">{p.name}</p>
                    <div className="flex items-center gap-2 ios-caption text-muted-foreground">
                      <span className="font-mono">{p.sku}</span>
                      <span>·</span>
                      <span>{isRTL ? 'المخزون' : 'Stock'}: <span className="font-semibold text-foreground">{p.stock}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="ios-body font-semibold text-foreground">{p.price}</span>
                    {/* Inline cost editing */}
                    {editingCostId === p.id ? (
                      <input
                        autoFocus
                        type="number"
                        value={costInput}
                        onChange={e => setCostInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCostSave(p.id); if (e.key === 'Escape') setEditingCostId(null) }}
                        onBlur={() => handleCostSave(p.id)}
                        className="w-20 px-1.5 py-0.5 text-[11px] border border-primary/30 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-card text-right font-mono"
                        dir="ltr"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingCostId(p.id); setCostInput(String(p.costPrice || 0)) }}
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors',
                          p.costPrice > 0
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15'
                            : 'text-muted-foreground border-dashed border-muted-foreground/30 hover:text-primary hover:bg-primary/5'
                        )}
                      >
                        {p.costPrice > 0 ? `Cost: ${p.costPrice}` : (isRTL ? '+ كوست' : '+ Cost')}
                      </button>
                    )}
                    <span className={cn("inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold", statusBadge(p.status))}>
                      {p.status === 'lowStock' && <AlertCircle className="w-3 h-3" />}
                      {dict.inventory.status[p.status]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center px-4 pb-2 -mt-1">
                  <div className="flex-1" />
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1 rounded-full bg-accent text-[12px] font-semibold text-muted-foreground">
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                        className="px-3 py-1 rounded-full bg-[#FF3B30] text-white text-[12px] font-semibold active:bg-[#D70015] disabled:opacity-50">
                        {deletingId === p.id ? '...' : (isRTL ? 'حذف' : 'Delete')}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(p.id)} disabled={deletingId === p.id}
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

      <ProductManagerDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        dict={dict}
        lang={lang}
      />

      {/* Sync modal — iOS alert */}
      {isSyncOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-md">
          <div className="bg-card/95 backdrop-blur-xl rounded-[14px] w-full max-w-[300px] shadow-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#30B24A]/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-[#30B24A]" />
              </div>
              <h3 className="ios-headline text-foreground mb-1">{isRTL ? 'مزامنة شوبيفاي' : 'Sync Shopify'}</h3>

              <div className="flex gap-0.5 my-3 bg-accent/60 p-0.5 rounded-[9px]">
                <button onClick={() => setSyncMode('single')}
                  className={cn("flex-1 py-1 text-[13px] font-semibold rounded-[7px] transition-all",
                    syncMode === 'single' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  )}>
                  {isRTL ? 'منتج واحد' : 'Single'}
                </button>
                <button onClick={() => setSyncMode('all')}
                  className={cn("flex-1 py-1 text-[13px] font-semibold rounded-[7px] transition-all",
                    syncMode === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  )}>
                  {isRTL ? 'الكل' : 'All'}
                </button>
              </div>

              {syncMode === 'single' ? (
                <input
                  type="text"
                  value={syncQuery}
                  onChange={(e) => setSyncQuery(e.target.value)}
                  placeholder={isRTL ? 'اسم المنتج أو رقمه' : 'Product name or ID'}
                  className="w-full bg-muted rounded-[10px] px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/25 text-center"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoFocus
                />
              ) : (
                <p className="ios-footnote text-muted-foreground leading-relaxed">
                  {isRTL ? 'سيتم تحديث جميع المنتجات من المتجر.' : 'All products will be synced from the store.'}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 border-t border-border">
              <button onClick={() => setIsSyncOpen(false)} disabled={isSyncing}
                className="py-2.5 ios-body text-primary active:bg-accent/60 transition-colors border-l border-border disabled:opacity-50">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSync}
                disabled={isSyncing || (syncMode === 'single' && !syncQuery.trim())}
                className="py-2.5 ios-body font-semibold text-primary active:bg-accent/60 transition-colors disabled:opacity-40">
                {isSyncing ? '...' : (isRTL ? 'تأكيد' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
