'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Phone, MapPin, Package, DollarSign, Hash, MessageCircle, Truck } from 'lucide-react'
import { updateOrderAction } from '@/app/actions/orders'
import { useRouter } from 'next/navigation'
import { EGYPT_GOVERNORATES } from '@/lib/order-utils'

export function OrderDetailsDrawer({ order, isOpen, onClose, lang, statuses }: {
  order: any
  isOpen: boolean
  onClose: () => void
  lang: string
  statuses?: any[]
}) {
  const router = useRouter()
  const [products, setProducts] = useState('')
  const [notes, setNotes] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [shippingPrice, setShippingPrice] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [waybillNumber, setWaybillNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [initialized, setInitialized] = useState(false)

  const computedTotal = (parseFloat(productPrice) || 0) + (parseFloat(shippingPrice) || 0)

  // Reset form when order changes
  if (order && !initialized) {
    let parsedProducts = ''
    let parsedNotes = ''
    if (order.notes) {
      let splitIndex = order.notes.indexOf('--- ملاحظات ---')
      let separatorLen = '--- ملاحظات ---'.length

      // Fallback to check for our old separator just in case
      if (splitIndex === -1) {
         splitIndex = order.notes.indexOf('--- من شوبيفاي ---')
         separatorLen = '--- من شوبيفاي ---'.length
      }

      if (splitIndex !== -1) {
        parsedProducts = order.notes.substring(0, splitIndex).trim()
        parsedNotes = order.notes.substring(splitIndex + separatorLen).trim()
      } else {
        if (order.source === 'shopify') parsedProducts = order.notes.trim()
        else parsedNotes = order.notes.trim()
      }
    }
    setProducts(parsedProducts)
    setNotes(parsedNotes)
    // Prefer explicit split columns; fall back to parsing the old metadata line in notes.
    let pp = typeof order.productAmount === 'number' ? order.productAmount : null
    let sp = typeof order.shippingAmount === 'number' ? order.shippingAmount : null
    if ((pp === null || sp === null) && order.notes) {
      const priceMatch = order.notes.match(/سعر المنتج:\s*([\d.]+)/)
      const shipMatch = order.notes.match(/الشحن:\s*([\d.]+)/)
      if (pp === null) pp = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0
      if (sp === null) sp = shipMatch ? parseFloat(shipMatch[1]) || 0 : 0
    }
    if (pp === null) pp = 0
    if (sp === null) sp = 0
    // If no split info, keep total visible as product price
    if (!pp && !sp && order.amount) pp = Number(order.amount) || 0
    setProductPrice(pp ? String(pp) : '')
    setShippingPrice(sp ? String(sp) : '')
    setCustomerName(order.customer || '')
    setPhone(order.phone || '')
    setAddress(order.address || '')
    setGovernorate(order.governorate || '')
    setSource(order.source || '')
    setStatus(order.status || '')
    setWaybillNumber(order.waybill_number || '')
    setInitialized(true)
  }

  const handleSave = async () => {
    if (!order) return
    setSaving(true)
    setMsg('')
    const pp = parseFloat(productPrice) || 0
    const sp = parseFloat(shippingPrice) || 0
    const result = await updateOrderAction(order.originalId, {
      products,
      notes,
      total: pp + sp,
      productPrice: pp,
      shippingPrice: sp,
      customerName,
      phone,
      address,
      governorate,
      source,
      status,
      waybill_number: waybillNumber || undefined,
      customerId: order.customer_id
    })
    setSaving(false)
    if (result.success) {
      setMsg(lang === 'ar' ? '✓ تم الحفظ بنجاح' : '✓ Saved successfully')
      setTimeout(() => { setMsg(''); onClose(); router.refresh() }, 1000)
    } else {
      setMsg(`خطأ: ${result.error}`)
    }
  }

  const handleClose = () => {
    setProducts('')
    setNotes('')
    setProductPrice('')
    setShippingPrice('')
    setCustomerName('')
    setPhone('')
    setAddress('')
    setSource('')
    setStatus('')
    setWaybillNumber('')
    setMsg('')
    setInitialized(false)
    onClose()
  }

  const whatsappHref = () => {
    if (!order?.phone) return '#'
    const clean = order.phone.replace(/\D/g, '')
    const intl = clean.startsWith('0') ? '2' + clean : clean
    let cleanNotes = order.notes ? order.notes.replace('--- ملاحظات ---', '\\n') : ''
    const m = encodeURIComponent(`مرحباً ${order.customer}،\nطلبك رقم: #${order.id}\nالمبلغ: ${order.amount} ج.م\n${cleanNotes}`)
    return `https://wa.me/${intl}?text=${m}`
  }

  return (
    <AnimatePresence>
      {isOpen && order && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]" />
          <motion.div
            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 right-0 w-full md:w-[480px] bg-background border-l border-border shadow-2xl z-[70] flex flex-col"
          >
            <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-sidebar shrink-0">
              <h2 className="text-lg font-serif font-semibold text-foreground">
                {lang === 'ar' ? 'تفاصيل الطلب' : 'Order Details'} — <span className="text-primary font-mono">#{order.id}</span>
              </h2>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-accent transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {msg && (
                <div className={`p-3 rounded-lg text-sm border ${msg.startsWith('✓') ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
                  {msg}
                </div>
              )}

              <div className="bg-accent/40 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{lang === 'ar' ? 'بيانات العميل' : 'Customer Info'}</h3>
                <div>
                  <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="font-bold text-foreground text-base w-full bg-background border border-border px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary" placeholder={lang === 'ar' ? 'اسم العميل' : 'Customer Name'} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-background border border-border px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-sm" dir="ltr" placeholder="Phone" />
                  </div>
                  {order.phone && (
                    <a href={whatsappHref()} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-3 py-2 rounded-lg hover:bg-green-500/15 transition-colors shrink-0">
                      <MessageCircle className="w-3.5 h-3.5" /> واتساب
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-background border border-border px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-sm" placeholder={lang === 'ar' ? 'العنوان' : 'Address'} />
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={governorate}
                    onChange={e => setGovernorate(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-primary text-sm appearance-none"
                  >
                    <option value="">{lang === 'ar' ? 'المحافظة...' : 'Governorate...'}</option>
                    {EGYPT_GOVERNORATES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-sidebar border border-border rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> {lang === 'ar' ? 'المصدر' : 'Source'}</p>
                  <input type="text" value={source} onChange={e => setSource(e.target.value)} className="w-full bg-background border border-border px-2 py-1 rounded outline-none focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <div className="bg-sidebar border border-border rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">الحالة</p>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-background border border-border px-2 py-1 rounded outline-none focus:ring-1 focus:ring-primary text-sm">
                    {statuses?.map((s: any) => (
                      <option key={s.id || s.value} value={s.id || s.value}>{lang === 'ar' ? s.label_ar : s.label_en}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-sidebar border border-border rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">{lang === 'ar' ? 'التاريخ' : 'Date'}</p>
                  <p className="font-semibold text-sm">{order.date}</p>
                  <p className="text-xs text-muted-foreground">{order.time}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><Package className="w-4 h-4" /> {lang === 'ar' ? 'المنتجات' : 'Products'}</span>
                </label>
                <textarea rows={3} value={products} onChange={e => setProducts(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none text-sm"
                  placeholder={lang === 'ar' ? 'تفاصيل المنتجات...' : 'Product details...'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">📝 {lang === 'ar' ? 'الملاحظات (تُزامن مع شوبيفاي)' : 'Notes (Synced to Shopify)'}</span>
                </label>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none text-sm"
                  placeholder={lang === 'ar' ? 'الملاحظات...' : 'Notes...'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {lang === 'ar' ? 'سعر المنتج' : 'Product Price'}
                  </label>
                  <input type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {lang === 'ar' ? 'سعر الشحن' : 'Shipping Price'}
                  </label>
                  <input type="number" value={shippingPrice} onChange={e => setShippingPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono"
                    placeholder="0" />
                </div>
              </div>

              <div className="bg-accent/50 p-4 rounded-xl border border-border flex justify-between items-center">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> {lang === 'ar' ? 'الإجمالي' : 'Total'}
                </span>
                <span className="font-mono font-bold text-xl text-primary">{computedTotal} EGP</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> {lang === 'ar' ? 'رقم بوليصة الشحن' : 'Waybill Number'}
                  </span>
                </label>
                <input
                  type="text"
                  value={waybillNumber}
                  onChange={e => setWaybillNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono"
                  dir="ltr"
                  placeholder="767872"
                />
                {order.tracking_status && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    {lang === 'ar' ? 'آخر حالة' : 'Latest'}: <span className="font-semibold text-foreground">{order.tracking_status}</span>
                    {order.tracking_status_date && <span className="text-muted-foreground">· {order.tracking_status_date}</span>}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 pb-12 md:pb-5 border-t border-border bg-sidebar/30 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)]">
              <div className="flex gap-3">
                <button onClick={handleClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-accent text-foreground font-medium transition-all">
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md transition-all disabled:opacity-60">
                  {saving ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save className="w-4 h-4" />}
                  {saving ? '...' : (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
