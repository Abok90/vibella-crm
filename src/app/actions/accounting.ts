'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addTransactionAction(data: {
  amount: string
  date: string
  type: string
  category: string
  notes: string
}) {
  try {
    const supabase = createAdminClient()

    const amountNum = parseFloat(data.amount)
    if (!amountNum || isNaN(amountNum)) {
      return { success: false, error: 'الرجاء إدخال مبلغ صحيح' }
    }

    const payload: Record<string, any> = {
      amount: amountNum,
      type: data.type || 'expense',
    }

    // transaction_date is a DATE column
    if (data.date) payload.transaction_date = data.date

    // category is a plain text column
    if (data.category) payload.category = data.category

    // notes
    if (data.notes) payload.notes = data.notes

    const { error } = await supabase.from('transactions').insert(payload)

    if (error) {
      return { success: false, error: `فشل تسجيل المعاملة: ${error.message}` }
    }

    revalidatePath('/[lang]/accounting', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ غير متوقع' }
  }
}

export async function deleteTransactionAction(id: string) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/[lang]/accounting', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function updateTransactionAction(id: string, data: {
  amount?: string
  date?: string
  type?: string
  category?: string
  notes?: string
}) {
  try {
    const supabase = createAdminClient()

    const payload: Record<string, any> = {}
    
    if (data.amount !== undefined) {
      const amountNum = parseFloat(data.amount)
      if (!amountNum || isNaN(amountNum)) return { success: false, error: 'الرجاء إدخال مبلغ صحيح' }
      payload.amount = amountNum
    }
    if (data.type !== undefined) payload.type = data.type
    if (data.date !== undefined) payload.transaction_date = data.date
    if (data.category !== undefined) payload.category = data.category
    if (data.notes !== undefined) payload.notes = data.notes

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', id)
      if (error) return { success: false, error: `فشل تعديل المعاملة: ${error.message}` }
    }

    revalidatePath('/[lang]/accounting', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ غير متوقع' }
  }
}
