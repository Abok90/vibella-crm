'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { addTransactionAction, updateTransactionAction } from '@/app/actions/accounting'

interface ExpenseDrawerProps {
  isOpen: boolean
  onClose: () => void
  dict: any
  lang: string
  transaction?: any
  categories?: any[]
}

export function ExpenseDrawer({ isOpen, onClose, dict, lang, transaction, categories }: ExpenseDrawerProps) {
  const isRTL = lang === 'ar'
  const slideFromX = isRTL ? '-100%' : '100%'
  
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState('Operational')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        setAmount(transaction.amount?.toString() || '')
        setDate(transaction.date || '')
        setType(transaction.type || 'expense')
        setCategory(transaction.category || 'Operational')
        setNotes(transaction.notes || '')
      } else {
        setAmount('')
        setDate('')
        setType('expense')
        setCategory(categories && categories.length > 0 ? categories[0].id : 'Operational')
        setNotes('')
      }
      setMessage('')
    }
  }, [isOpen, transaction, categories])

  const handleSave = async () => {
    setIsLoading(true)
    setMessage('')
    let result;
    if (transaction) {
      result = await updateTransactionAction(transaction.id, {
        amount, date, type, category, notes
      })
    } else {
      result = await addTransactionAction({
        amount, date, type, category, notes
      })
    }
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
              <h2 className="text-xl font-serif font-semibold text-foreground">
                {transaction ? (lang === 'ar' ? 'تعديل المعاملة' : 'Edit Transaction') : dict.accounting.drawer.title}
              </h2>
              <button onClick={onClose} className="p-2 rounded-full bg-accent/50 hover:bg-accent text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                {message && <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-500/20">{message}</div>}
                
                <div className="flex gap-4 p-1 bg-accent rounded-xl w-full">
                   <button onClick={() => setType('expense')} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${type === 'expense' ? 'bg-background shadow text-red-600' : 'text-muted-foreground'}`}>
                     {lang === 'ar' ? 'مصروف' : 'Expense'}
                   </button>
                   <button onClick={() => setType('income')} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${type === 'income' ? 'bg-background shadow text-green-600' : 'text-muted-foreground'}`}>
                     {lang === 'ar' ? 'إيراد' : 'Income'}
                   </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{dict.accounting.drawer.amount}</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono text-lg" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{dict.accounting.drawer.date}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{dict.accounting.drawer.mainCategory}</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm">
                      {categories && categories.length > 0 ? categories.filter(c => c.type === type).map(c => (
                        <option key={c.id || c.value} value={c.id || c.value}>{lang === 'ar' ? c.label_ar : c.label_en}</option>
                      )) : (
                        <>
                          <option value="Operational">Operational</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Salaries">Salaries</option>
                          <option value="Sales">Sales (Income)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{dict.accounting.drawer.notes}</label>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm resize-none" placeholder="..."></textarea>
                </div>
              </div>
            </div>

            <div className="p-6 pb-12 md:pb-6 border-t border-border bg-sidebar/30">
              <div className="flex gap-4">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-accent text-foreground font-medium transition-all">
                  {dict.accounting.drawer.cancel}
                </button>
                <button onClick={handleSave} disabled={isLoading} className="flex-1 px-4 py-2.5 rounded-xl border-transparent bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md transition-all flex justify-center items-center">
                  {isLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : dict.accounting.drawer.save}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
