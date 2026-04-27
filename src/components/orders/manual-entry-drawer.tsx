'use client'

import { X, ChevronDown, Package, Check, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createOrderAction } from '@/app/actions/orders'
import { EGYPT_GOVERNORATES } from '@/lib/order-utils'
import { ProductCombobox, type ProductOption } from './product-combobox'


interface ManualEntryDrawerProps {
  isOpen: boolean
  onClose: () => void
  dict: any
  lang: string
  products?: ProductOption[]
}

export function ManualEntryDrawer({ isOpen, onClose, dict, lang, products: productOptions }: ManualEntryDrawerProps) {
  const isRTL = lang === 'ar'
  const slideFromX = isRTL ? '-100%' : '100%'

  const [orderId, setOrderId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [products, setProducts] = useState('')
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState('facebook')
  
  const [productPrice, setProductPrice] = useState<number>(0)
  const [shippingPrice, setShippingPrice] = useState<number>(0)
  const total = (productPrice || 0) + (shippingPrice || 0)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setOrderId('')
      setCustomerName('')
      setPhone('')
      setAddress('')
      setGovernorate('')
      setProducts('')
      setNotes('')
      setSource('facebook')
      setProductPrice(0)
      setShippingPrice(0)
      setMessage('')
    }
  }, [isOpen])

  const handleSave = async () => {
    setIsLoading(true)
    setMessage('')
    const result = await createOrderAction({
      orderId, customerName, phone, address, governorate, products, notes, source, productPrice, shippingPrice, total
    })
    setIsLoading(false)
    if (result.success) {
      onClose()
    } else {
      setMessage(result.error)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: slideFromX, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: slideFromX, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 bottom-0 ${isRTL ? 'left-0' : 'right-0'} w-full md:w-[450px] bg-background border-${isRTL ? 'r' : 'l'} border-border shadow-2xl z-[70] flex flex-col`}
          >
            <div className="h-20 px-6 flex items-center justify-between border-b border-border bg-sidebar">
              <h2 className="text-xl font-serif font-semibold text-foreground">{dict.orders.drawer.manualEntryTitle}</h2>
              <button onClick={onClose} className="p-2 rounded-full bg-accent/50 hover:bg-accent text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                {/* Form Message */}
                {message && <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-500/20">{message}</div>}

                {/* Order ID Auto */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{dict.orders.columns.id} (Optional)</label>
                  <input type="text" value={orderId} onChange={e => setOrderId(e.target.value)} placeholder={lang === 'ar' ? 'يتم إنشاؤه تلقائياً أو أدخله يدوياً' : 'Auto-generated or enter manually'} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-medium" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.orders.drawer.customerName}</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.orders.columns.phone}</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} pattern="\d{11}" placeholder="01X XXXX XXXX" className="w-full text-left px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono" dir="ltr" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.orders.drawer.address}</label>
                    <textarea rows={2} value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none"></textarea>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      <MapPin className="w-3.5 h-3.5 inline-block me-1 opacity-60" />
                      {lang === 'ar' ? 'المحافظة' : 'Governorate'}
                    </label>
                    <select
                      value={governorate}
                      onChange={e => setGovernorate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm appearance-none"
                    >
                      <option value="">{lang === 'ar' ? 'اختر المحافظة...' : 'Select governorate...'}</option>
                      {EGYPT_GOVERNORATES.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-1.5">{lang === 'ar' ? 'المنتجات' : 'Products'}</label>
                  <ProductCombobox
                    value={products}
                    onChange={setProducts}
                    lang={lang}
                    options={productOptions}
                    onPickPrice={(price) => { if (price && !productPrice) setProductPrice(price) }}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {lang === 'ar'
                      ? 'اختر من المنتجات أو اكتب يدوياً'
                      : 'Pick from catalog or type freely'}
                  </p>
                </div>

                <div className="pt-2 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-1.5">{lang === 'ar' ? 'الملاحظات (تُزامن مع شوبيفاي)' : 'Notes (Synced to Shopify)'}</label>
                  <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none"></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{lang === 'ar' ? 'سعر المنتج' : 'Product Price'}</label>
                    <input type="number" value={productPrice || ''} onChange={e => setProductPrice(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{lang === 'ar' ? 'سعر الشحن' : 'Shipping Price'}</label>
                    <input type="number" value={shippingPrice || ''} onChange={e => setShippingPrice(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono" placeholder="0" />
                  </div>
                </div>

                <div className="bg-accent/50 p-4 rounded-xl border border-border flex justify-between items-center mb-2">
                  <span className="font-semibold text-foreground">{lang === 'ar' ? 'الإجمالي' : 'Total'}</span>
                  <span className="font-mono font-bold text-xl text-primary">{total} EGP</span>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-3">{dict.orders.columns.source}</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="source" value="facebook" checked={source === 'facebook'} onChange={e => setSource(e.target.value)} className="w-4 h-4 text-primary focus:ring-primary accent-primary" />
                      <span className="text-sm font-medium">{lang === 'ar' ? 'فيسبوك' : 'Facebook'}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="source" value="instagram" checked={source === 'instagram'} onChange={e => setSource(e.target.value)} className="w-4 h-4 text-primary focus:ring-primary accent-primary" />
                      <span className="text-sm font-medium">{lang === 'ar' ? 'إنستقرام' : 'Instagram'}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="source" value="shopify" checked={source === 'shopify'} onChange={e => setSource(e.target.value)} className="w-4 h-4 text-primary focus:ring-primary accent-primary" />
                      <span className="text-sm font-medium">{lang === 'ar' ? 'الموقع (Shopify)' : 'Shopify'}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="source" value="manual" checked={source === 'manual'} onChange={e => setSource(e.target.value)} className="w-4 h-4 text-primary focus:ring-primary accent-primary" />
                      <span className="text-sm font-medium">{lang === 'ar' ? 'يدوي' : 'Manual'}</span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-6 pb-12 md:pb-6 border-t border-border bg-sidebar/30 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)]">
              <div className="flex gap-4">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-accent text-foreground font-medium transition-all">
                  {dict.orders.drawer.cancel}
                </button>
                <button onClick={handleSave} disabled={isLoading} className="flex-1 px-4 py-2.5 rounded-xl border-transparent bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md transition-all flex justify-center items-center">
                  {isLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : dict.orders.drawer.save}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
