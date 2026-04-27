'use server'

const GOOGLE_SHEETS_SCRIPT_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxxm2rRzFrpM8lJIP8lQ01GUZCS8W-pZRNOM5j1EH8AgVgmMTLlJwmSEDT7qWIBN7BaCw/exec'

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

    // Google Apps Script redirects (302) — use redirect: 'follow'
    const res = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ orders }),
      redirect: 'follow',
    })

    const text = await res.text()

    // Apps Script may return 200 after redirect with response text
    if (text.includes('error')) {
      return { success: false, error: `خطأ من Google: ${text}` }
    }

    return { success: true, count: orders.length }
  } catch (error: any) {
    return { success: false, error: error?.message || 'فشل الاتصال بـ Google Sheets' }
  }
}

