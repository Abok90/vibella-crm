'use client'

import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { createProductAction } from '@/app/actions/inventory'

interface ProductManagerDrawerProps {
  isOpen: boolean
  onClose: () => void
  dict: any
  lang: string
}

export function ProductManagerDrawer({ isOpen, onClose, dict, lang }: ProductManagerDrawerProps) {
  const isRTL = lang === 'ar'
  const slideFromX = isRTL ? '-100%' : '100%'
  const [variants, setVariants] = useState([{ id: 1, size: 'M', color: 'Beige', weight: '0.4', stock: 15, img: '' }])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Form states
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [basePrice, setBasePrice] = useState('3400')
  const [costPrice, setCostPrice] = useState('1200')
  const [descriptionAr, setDescriptionAr] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')

  const handleSave = async () => {
    setIsLoading(true)
    setMessage('')
    const result = await createProductAction({
      name_ar: nameAr || 'منتج جديد',
      name_en: nameEn || 'New Product',
      base_price: parseFloat(basePrice) || 0,
      cost_price: parseFloat(costPrice) || 0,
      description_ar: descriptionAr,
      description_en: descriptionEn,
      variants: variants.map(v => ({
         size: v.size || 'OS',
         color: v.color || 'Default',
         weight: parseFloat(v.weight) || 0,
         stock_level: typeof v.stock === 'number' ? v.stock : parseInt(v.stock as unknown as string) || 0,
         image_url: v.img
      }))
    })
    setIsLoading(false)
    if (result.success) {
      onClose()
    } else {
      setMessage(result.error)
    }
  }

  const addVariant = () => {
    setVariants([...variants, { id: Date.now(), size: '', color: '', weight: '', stock: 0, img: '' }])
  }

  const removeVariant = (id: number) => {
    setVariants(variants.filter(v => v.id !== id))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: slideFromX, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: slideFromX, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 bottom-0 ${isRTL ? 'left-0' : 'right-0'} w-full md:w-[650px] bg-background border-${isRTL ? 'r' : 'l'} border-border shadow-2xl z-[70] flex flex-col`}
          >
            <div className="h-20 px-6 flex items-center justify-between border-b border-border bg-sidebar shrink-0">
              <h2 className="text-xl font-serif font-semibold text-foreground">{dict.inventory.drawer.addTitle}</h2>
              <button onClick={onClose} className="p-2 rounded-full bg-accent/50 hover:bg-accent text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Basic Info */}
              <div className="space-y-4">
                {message && <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-500/20">{message}</div>}
                <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">{dict.inventory.drawer.basicInfo}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.inventory.drawer.productName} (AR)</label>
                    <input value={nameAr} onChange={e => setNameAr(e.target.value)} type="text" className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm" placeholder="فستان إيليت" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.inventory.drawer.productName} (EN)</label>
                    <input value={nameEn} onChange={e => setNameEn(e.target.value)} type="text" className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm" placeholder="Elite Dress" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.inventory.drawer.basePrice}</label>
                    <input value={basePrice} onChange={e => setBasePrice(e.target.value)} type="number" className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono" placeholder="3400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.inventory.drawer.costPrice}</label>
                    <input value={costPrice} onChange={e => setCostPrice(e.target.value)} type="number" className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono" placeholder="1200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.inventory.drawer.description} (AR)</label>
                    <textarea value={descriptionAr} onChange={e => setDescriptionAr(e.target.value)} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none" placeholder="..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.inventory.drawer.description} (EN)</label>
                    <textarea value={descriptionEn} onChange={e => setDescriptionEn(e.target.value)} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none" placeholder="..." />
                  </div>
                </div>
              </div>

              {/* Variants Matrix */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">{dict.inventory.drawer.variants}</h3>
                  <button onClick={addVariant} className="flex items-center gap-1.5 text-sm font-medium text-foreground bg-accent py-1.5 px-3 rounded-full hover:bg-border transition-colors">
                    <Plus className="w-4 h-4" /> {dict.inventory.drawer.addVariant}
                  </button>
                </div>
                
                <div className="space-y-4">
                  {variants.map((v, index) => (
                    <motion.div 
                      key={v.id} 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-sidebar border border-border rounded-xl p-4 shadow-sm relative group transition-colors hover:border-primary/50"
                    >
                       <div className="flex items-start gap-5">
                         {/* Variant Image Uploader */}
                         <div className="w-20 h-24 shrink-0 rounded-lg border-2 border-dashed border-border bg-background flex flex-col items-center justify-center text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer group/img overflow-hidden relative">
                           {v.img ? (
                             <img src={v.img} alt="Variant" className="w-full h-full object-cover" />
                           ) : (
                             <>
                               <ImageIcon className="w-6 h-6 mb-1 text-muted-foreground group-hover/img:text-primary transition-colors" />
                               <span className="text-[10px] font-medium uppercase text-center px-1">{dict.inventory.drawer.variantImage}</span>
                             </>
                           )}
                         </div>
                         
                         {/* Variant Details */}
                         <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">{dict.inventory.drawer.variantSize}</label>
                              <input type="text" value={v.size} onChange={e => setVariants(variants.map(varItem => varItem.id === v.id ? {...varItem, size: e.target.value} : varItem))} className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary/50 outline-none transition-all shadow-sm" placeholder="M" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">{dict.inventory.drawer.variantColor}</label>
                              <input type="text" value={v.color} onChange={e => setVariants(variants.map(varItem => varItem.id === v.id ? {...varItem, color: e.target.value} : varItem))} className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary/50 outline-none transition-all shadow-sm" placeholder="Beige" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">{dict.inventory.drawer.variantWeight}</label>
                              <input type="number" value={v.weight} onChange={e => setVariants(variants.map(varItem => varItem.id === v.id ? {...varItem, weight: e.target.value} : varItem))} step="0.1" className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary/50 outline-none transition-all font-mono shadow-sm" placeholder="0.5" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">{dict.inventory.drawer.variantStock}</label>
                              <input type="number" value={v.stock} onChange={e => setVariants(variants.map(varItem => varItem.id === v.id ? {...varItem, stock: parseInt(e.target.value) || 0} : varItem))} className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary/50 outline-none transition-all font-mono shadow-sm" placeholder="0" />
                            </div>
                         </div>
                       </div>
                       
                       {variants.length > 1 && (
                         <button onClick={() => removeVariant(v.id)} className="absolute -top-2 -right-2 p-1.5 bg-background border border-border rounded-full text-muted-foreground hover:text-red-500 hover:border-red-200 shadow-sm transition-colors opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 pb-12 md:pb-6 border-t border-border bg-sidebar/30 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)]">
              <div className="flex gap-4">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-accent text-foreground font-medium transition-all">
                  {dict.inventory.drawer.cancel}
                </button>
                <button onClick={handleSave} disabled={isLoading} className="flex-1 px-4 py-2.5 rounded-xl border-transparent bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md transition-all flex items-center justify-center">
                  {isLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : dict.inventory.drawer.save}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
