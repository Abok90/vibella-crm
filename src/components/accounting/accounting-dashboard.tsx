'use client'

import { useState, useEffect } from 'react'
import { Plus, Wallet, ArrowDownRight, ArrowUpRight, Trash2, Edit3 } from 'lucide-react'
import { ExpenseDrawer } from './expense-drawer'
import { deleteTransactionAction } from '@/app/actions/accounting'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function AccountingDashboard({ dict, lang, initialTransactions, categories }: { dict: any, lang: string, initialTransactions?: any[], categories?: any[] }) {
  const router = useRouter()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [localTransactions, setLocalTransactions] = useState(initialTransactions || [])
  useEffect(() => { setLocalTransactions(initialTransactions || []) }, [initialTransactions])

  const transactions = localTransactions

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  const balance = totalIncome - totalExpense

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
    setSelectedTransaction(null)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null)
    setDeletingId(id)
    const result = await deleteTransactionAction(id)
    setDeletingId(null)
    if (result.success) {
      setLocalTransactions(prev => prev.filter(t => t.id !== id))
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  return (
    <div className="space-y-5">
      {/* Large title */}
      <div className="flex items-end justify-between gap-3 pt-1">
        <div>
          <h1 className="ios-large-title text-foreground">{dict.accounting.title}</h1>
          <p className="ios-subheadline text-muted-foreground mt-0.5">
            <span className={cn("font-semibold", balance >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
              EGP {balance.toLocaleString()}
            </span>
            <span className="text-muted-foreground"> · {dict.accounting.balance}</span>
          </p>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-full active:bg-primary/90 transition-colors text-[13px] font-semibold flex-shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          <span>{dict.accounting.addExpense}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="bg-card rounded-[14px] p-3 md:p-4">
          <p className="ios-caption text-[#34C759] font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span className="truncate">{lang === 'ar' ? 'إيرادات' : 'Income'}</span>
          </p>
          <p className="ios-headline text-foreground mt-1 break-all">EGP {totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-[14px] p-3 md:p-4">
          <p className="ios-caption text-[#FF3B30] font-semibold flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span className="truncate">{lang === 'ar' ? 'مصروفات' : 'Expenses'}</span>
          </p>
          <p className="ios-headline text-foreground mt-1 break-all">EGP {totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-[14px] p-3 md:p-4">
          <p className="ios-caption text-primary font-semibold flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span className="truncate">{lang === 'ar' ? 'الرصيد' : 'Balance'}</span>
          </p>
          <p className={cn("ios-headline mt-1 break-all", balance >= 0 ? 'text-foreground' : 'text-[#FF3B30]')}>
            EGP {balance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* iOS grouped list (works on both mobile and desktop) */}
      <div>
        <h3 className="ios-footnote text-muted-foreground uppercase tracking-wider mb-2 px-1">
          {dict.accounting.transactions}
        </h3>
        {transactions.length === 0 ? (
          <div className="bg-card rounded-[14px] p-10 text-center">
            <Wallet className="w-9 h-9 mx-auto mb-2 opacity-20" />
            <p className="ios-subheadline text-muted-foreground">
              {lang === 'ar' ? 'لا توجد معاملات بعد' : 'No transactions yet'}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-[14px] overflow-hidden">
            {transactions.map((trx, idx) => {
              const isLast = idx === transactions.length - 1
              const isIncome = trx.type === 'income'
              return (
                <div key={trx.id} className={cn("transition-opacity", deletingId === trx.id && "opacity-40")}>
                  <div className="flex items-center gap-3 px-4 py-3 active:bg-accent/40 transition-colors">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                      isIncome ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'
                    )}>
                      {isIncome ? <ArrowUpRight className="w-5 h-5" strokeWidth={2} /> : <ArrowDownRight className="w-5 h-5" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="ios-body font-semibold text-foreground truncate">{trx.category || '-'}</p>
                      <p className="ios-caption text-muted-foreground truncate">
                        <span dir="ltr">{trx.date}</span>
                        {trx.notes && <span> · {trx.notes}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={cn("ios-body font-semibold", isIncome ? 'text-[#34C759]' : 'text-[#FF3B30]')}>
                        {isIncome ? '+' : '-'}{parseFloat(trx.amount).toLocaleString()}
                      </span>
                      <span className="ios-caption text-muted-foreground">ج.م</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-4 pb-2 -mt-1">
                    <button
                      onClick={() => { setSelectedTransaction(trx); setIsDrawerOpen(true); }}
                      className="p-1.5 rounded-full active:bg-accent text-primary transition-colors"
                    >
                      <Edit3 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                    </button>
                    <div className="flex-1" />
                    {confirmDeleteId === trx.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1 rounded-full bg-accent text-[12px] font-semibold text-muted-foreground">
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button onClick={() => handleDelete(trx.id)} disabled={deletingId === trx.id}
                          className="px-3 py-1 rounded-full bg-[#FF3B30] text-white text-[12px] font-semibold active:bg-[#D70015] disabled:opacity-50">
                          {deletingId === trx.id ? '...' : (lang === 'ar' ? 'حذف' : 'Delete')}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(trx.id)}
                        className="p-1.5 rounded-full active:bg-accent text-[#FF3B30] transition-colors">
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

      <ExpenseDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        dict={dict}
        lang={lang}
        transaction={selectedTransaction}
        categories={categories}
      />
    </div>
  )
}
