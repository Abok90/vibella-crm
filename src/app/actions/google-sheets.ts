'use server'

const GOOGLE_SHEETS_SCRIPT_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || ''

interface SheetOrder {
  orderId: string
  customer: string
  phone: string
  notes: string
  area: string
  address: string
  governorate: string
  content: string
  quantity: number
  amount: number
  status: string
  date: string
}

export async function exportOrdersToGoogleSheets(orders: SheetOrder[]) {
  try {
    if (!GOOGLE_SHEETS_SCRIPT_URL) {
      return { success: false, error: 'رابط Google Sheets غير مُعد. أضف GOOGLE_SHEETS_WEBHOOK_URL في إعدادات البيئة.' }
    }

    const res = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `خطأ من Google: ${text}` }
    }

    return { success: true, count: orders.length }
  } catch (error: any) {
    return { success: false, error: error?.message || 'فشل الاتصال بـ Google Sheets' }
  }
}
