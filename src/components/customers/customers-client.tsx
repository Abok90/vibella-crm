'use client'

import { useState, useEffect, useMemo } from 'react'
import { Users, Phone, MapPin, Trash2, Edit3, X, Check, Download, AlertTriangle, CheckSquare } from 'lucide-react'
import { deleteCustomerAction, updateCustomerAction, deleteMultipleCustomersAction } from '@/app/actions/customers'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

export function CustomersClient({ dict, lang, initialCustomers }: { dict: any, lang: string, initialCustomers: any[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', phone_number: '', address: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  const [localCustomers, setLocalCustomers] = useState(initialCustomers || [])
  useEffect(() => { setLocalCustomers(initialCustomers || []) }, [initialCustomers])

  const customers = localCustomers

  const phoneCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of customers) {
      if (c.phone_number && c.phone_number.trim().length > 0) {
         counts[c.phone_number] = (counts[c.phone_number] || 0) + 1
      }
    }
    return counts
  }, [customers])

  const startEdit = (c: any) => {
    setEditingId(c.id)
    setEditData({ name: c.full_name || '', phone_number: c.phone_number || '', address: c.address || '' })
  }

  const saveEdit = async (id: string) => {
    const result = await updateCustomerAction(id, editData)
    if (result.success) {
      setEditingId(null)
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null)
    setDeletingId(id)
    const result = await deleteCustomerAction(id)
    setDeletingId(null)
    if (result.success) {
      setLocalCustomers(prev => prev.filter(c => c.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      router.refresh()
    } else {
      alert(result.error)
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectAllDuplicates = () => {
    // Select all customers that share a phone number, but spare the first instance to keep it.
    const seen = new Set<string>()
    const dupesToSelect: string[] = []
    for (const c of customers) {
      if (c.phone_number && c.phone_number.trim().length > 0 && phoneCounts[c.phone_number] > 1) {
        if (seen.has(c.phone_number)) {
          dupesToSelect.push(c.id)
        } else {
          seen.add(c.phone_number)
        }
      }
    }
    setSelectedIds(new Set(dupesToSelect))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف العملاء المحددين بشكل نهائي؟' : 'Are you sure you want to permanently delete selected customers?')) return
    setIsDeletingBulk(true)
    const idsArray = Array.from(selectedIds)
    const res = await deleteMultipleCustomersAction(idsArray)
    setIsDeletingBulk(false)
    if (res.success) {
      setLocalCustomers(prev => prev.filter(c => !selectedIds.has(c.id)))
      setSelectedIds(new Set())
      router.refresh()
    } else {
      alert(res.error)
    }
  }

  const handleExportExcel = () => {
    if (selectedIds.size === 0) return
    const selectedCustomers = customers.filter(c => selectedIds.has(c.id)).map(c => ({
      [lang === 'ar' ? 'الاسم' : 'Name']: c.full_name || '',
      [lang === 'ar' ? 'الهاتف' : 'Phone']: c.phone_number || '',
      [lang === 'ar' ? 'العنوان' : 'Address']: c.address || '',
      [lang === 'ar' ? 'تاريخ الإضافة' : 'Date Added']: c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(selectedCustomers)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers")
    XLSX.writeFile(workbook, "Selected_Customers.xlsx")
  }

  return (
    <div className="space-y-4">
      <div className="pt-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ios-large-title text-foreground">{dict.navigation?.customers || 'العملاء'}</h1>
          <p className="ios-subheadline text-muted-foreground mt-0.5">
            {customers.length} {lang === 'ar' ? 'عميل' : 'customers'}
          </p>
        </div>
        
        {/* Bulk Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 ? (
            <>
              <span className="text-[13px] font-medium text-foreground bg-muted px-3 py-1.5 rounded-full">
                {selectedIds.size} {lang === 'ar' ? 'محدد' : 'Selected'}
              </span>
              <button 
                onClick={clearSelection}
                className="text-[13px] font-semibold text-muted-foreground hover:text-foreground px-2"
              >
                {lang === 'ar' ? 'إلغاء التحديد' : 'Clear'}
              </button>
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#34C759] text-white text-[13px] font-semibold rounded-full hover:opacity-90 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                {lang === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3B30] text-white text-[13px] font-semibold rounded-full hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingBulk ? '...' : (lang === 'ar' ? 'حذف المحدد' : 'Delete Selected')}
              </button>
            </>
          ) : (
             <button 
               onClick={selectAllDuplicates}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-800 border border-yellow-200 text-[13px] font-semibold rounded-full hover:bg-yellow-200 active:scale-95 transition-all"
               title={lang === 'ar' ? 'تحديد كل العملاء ذوي الأرقام المكررة' : 'Select all duplicated customers'}
             >
               <AlertTriangle className="w-4 h-4" />
               {lang === 'ar' ? 'تحديد المتكرر' : 'Select Duplicates'}
             </button>
          )}
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="bg-card rounded-[14px] p-10 text-center">
          <Users className="w-9 h-9 mx-auto mb-2 opacity-20" />
          <p className="ios-subheadline text-muted-foreground">{lang === 'ar' ? 'لا يوجد عملاء' : 'No customers yet'}</p>
        </div>
      ) : (
        <div className="bg-card rounded-[14px] overflow-hidden">
          {customers.map((c, idx) => {
            const isLast = idx === customers.length - 1
            const isEditing = editingId === c.id
            const isDuplicate = c.phone_number && phoneCounts[c.phone_number] > 1
            const isSelected = selectedIds.has(c.id)
            
            return (
              <div key={c.id} className={cn("transition-opacity flex items-stretch", deletingId === c.id && "opacity-40", isSelected && "bg-accent/20")}>
                
                {/* Selection Checkbox Area */}
                <div 
                  className="pl-4 pr-1 py-4 flex items-center justify-center cursor-pointer hover:bg-accent/30"
                  onClick={() => toggleSelect(c.id)}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border border-border flex items-center justify-center transition-colors",
                    isSelected ? "bg-primary border-primary text-white" : "text-transparent"
                  )}>
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="px-4 py-3 space-y-2">
                      <input type="text" value={editData.name}
                        onChange={e => setEditData({ ...editData, name: e.target.value })}
                        placeholder={lang === 'ar' ? 'الاسم' : 'Name'}
                        className="w-full bg-muted/80 rounded-[10px] px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/25"
                      />
                      <input type="tel" value={editData.phone_number}
                        onChange={e => setEditData({ ...editData, phone_number: e.target.value })}
                        maxLength={11}
                        placeholder={lang === 'ar' ? 'الهاتف' : 'Phone'}
                        className="w-full bg-muted/80 rounded-[10px] px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/25 font-mono"
                        dir="ltr"
                      />
                      <input type="text" value={editData.address}
                        onChange={e => setEditData({ ...editData, address: e.target.value })}
                        placeholder={lang === 'ar' ? 'العنوان' : 'Address'}
                        className="w-full bg-muted/80 rounded-[10px] px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/25"
                      />
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-full bg-accent text-[12px] font-semibold text-muted-foreground flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button onClick={() => saveEdit(c.id)}
                          className="px-3 py-1.5 rounded-full bg-[#34C759] text-white text-[12px] font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {lang === 'ar' ? 'حفظ' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 px-3 py-3 active:bg-accent/40 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 relative">
                          <Users className="w-5 h-5" strokeWidth={1.8} />
                          {isDuplicate && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-card flex items-center justify-center" title={lang === 'ar' ? 'مكرر' : 'Duplicate'}>
                              <AlertTriangle className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="ios-body font-semibold text-foreground truncate">{c.full_name || (lang === 'ar' ? 'غير معروف' : 'Unknown')}</p>
                          <div className="flex items-center gap-2 ios-footnote text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-mono" dir="ltr">{c.phone_number || '-'}</span>
                            {isDuplicate && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-sm lg:inline-block hidden">
                                  {lang === 'ar' ? 'متكرر' : 'Duplicated'}
                                </span>
                            )}
                          </div>
                          {c.address && (
                            <div className="flex items-center gap-2 ios-caption text-muted-foreground mt-0.5">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center px-4 pb-2 -mt-1">
                        <button onClick={() => startEdit(c)}
                          className="p-1.5 rounded-full active:bg-accent text-primary transition-colors">
                          <Edit3 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                        </button>
                        <div className="flex-1" />
                        {confirmDeleteId === c.id ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 rounded-full bg-accent text-[12px] font-semibold text-muted-foreground">
                              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
                              className="px-3 py-1 rounded-full bg-[#FF3B30] text-white text-[12px] font-semibold active:bg-[#D70015] disabled:opacity-50">
                              {deletingId === c.id ? '...' : (lang === 'ar' ? 'حذف' : 'Delete')}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(c.id)}
                            className="p-1.5 rounded-full active:bg-accent text-[#FF3B30] transition-colors">
                            <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {!isLast && <div className="h-px bg-border mx-4" />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
