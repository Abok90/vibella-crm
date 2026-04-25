'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash, Save } from 'lucide-react'
import { getSystemSettingAction, updateSystemSettingAction } from '@/app/actions/system'

interface StatusItem {
  id: string
  label_ar: string
  label_en: string
  color: string
}

export default function StatusesSettings({ lang }: { lang: string }) {
  const [statuses, setStatuses] = useState<StatusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSystemSettingAction('order_statuses').then(res => {
      if (res.success && res.data) {
        setStatuses(typeof res.data === 'string' ? JSON.parse(res.data) : res.data)
      }
      setLoading(false)
    })
  }, [])

  const handleAdd = () => {
    setStatuses([
      ...statuses,
      { id: `status_${Date.now()}`, label_ar: 'جديد', label_en: 'New', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20' }
    ])
  }

  const handleRemove = (index: number) => {
    setStatuses(statuses.filter((_, i) => i !== index))
  }

  const updateStatus = (index: number, field: string, value: string) => {
    const newStatuses = [...statuses]
    newStatuses[index] = { ...newStatuses[index], [field]: value }
    setStatuses(newStatuses)
  }

  const handleSave = async () => {
    setSaving(true)
    await updateSystemSettingAction('order_statuses', statuses)
    setSaving(false)
  }

  if (loading) return <div>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">{lang === 'ar' ? 'حالات الطلبات' : 'Order Statuses'}</h2>
        <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 text-foreground text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          {lang === 'ar' ? 'إضافة حالة' : 'Add Status'}
        </button>
      </div>

      <div className="space-y-3">
        {statuses.map((status, index) => (
          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-background border border-border rounded-xl shadow-sm">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">ID / Key</label>
                <input type="text" value={status.id} onChange={e => updateStatus(index, 'id', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">عربي</label>
                <input type="text" value={status.label_ar} onChange={e => updateStatus(index, 'label_ar', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">English</label>
                <input type="text" value={status.label_en} onChange={e => updateStatus(index, 'label_en', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Color CSS Classes</label>
                <input type="text" value={status.color} onChange={e => updateStatus(index, 'color', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none font-mono text-[10px]" />
              </div>
            </div>
            <button onClick={() => handleRemove(index)} className="p-2 sm:mt-5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border-transparent bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md transition-all">
          <Save className="w-5 h-5" />
          {saving ? '...' : (lang === 'ar' ? 'حفظ الحالات' : 'Save Statuses')}
        </button>
      </div>
    </div>
  )
}
