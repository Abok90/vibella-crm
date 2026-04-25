'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash, Save } from 'lucide-react'
import { getSystemSettingAction, updateSystemSettingAction } from '@/app/actions/system'

interface CategoryItem {
  id: string
  label_ar: string
  label_en: string
  type: string
}

export default function CategoriesSettings({ lang }: { lang: string }) {
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSystemSettingAction('accounting_categories').then(res => {
      if (res.success && res.data) {
        setCategories(typeof res.data === 'string' ? JSON.parse(res.data) : res.data)
      }
      setLoading(false)
    })
  }, [])

  const handleAdd = () => {
    setCategories([
      ...categories,
      { id: `cat_${Date.now()}`, label_ar: 'جديد', label_en: 'New', type: 'expense' }
    ])
  }

  const handleRemove = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index))
  }

  const updateCategory = (index: number, field: string, value: string) => {
    const newCats = [...categories]
    newCats[index] = { ...newCats[index], [field]: value }
    setCategories(newCats)
  }

  const handleSave = async () => {
    setSaving(true)
    await updateSystemSettingAction('accounting_categories', categories)
    setSaving(false)
  }

  if (loading) return <div>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">{lang === 'ar' ? 'بنود الحسابات' : 'Accounting Categories'}</h2>
        <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 text-foreground text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          {lang === 'ar' ? 'إضافة بند' : 'Add Category'}
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((cat, index) => (
          <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-background border border-border rounded-xl shadow-sm">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">ID (Unique)</label>
                <input type="text" value={cat.id} onChange={e => updateCategory(index, 'id', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">عربي</label>
                <input type="text" value={cat.label_ar} onChange={e => updateCategory(index, 'label_ar', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">English</label>
                <input type="text" value={cat.label_en} onChange={e => updateCategory(index, 'label_en', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Type (income/expense)</label>
                <select value={cat.type} onChange={e => updateCategory(index, 'type', e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-sidebar outline-none">
                  <option value="expense">Expense (مصروف)</option>
                  <option value="income">Income (إيراد)</option>
                </select>
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
          {saving ? '...' : (lang === 'ar' ? 'حفظ البنود' : 'Save Categories')}
        </button>
      </div>
    </div>
  )
}
