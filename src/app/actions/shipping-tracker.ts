'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Portal: TwoWay Express (https://www.twowayexpress.com).
// It's an ASP.NET Web Forms app — no API. We log in with user/pass, then scrape
// /clientorders which lists every shipment in one table.

const LOGIN_URL = 'https://www.twowayexpress.com/index'
const ORDERS_URL = 'https://www.twowayexpress.com/clientorders'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const MAX_PAGES = 30

type CookieJar = Record<string, string>

function updateJar(jar: CookieJar, setCookie: string[] | string | null | undefined) {
  if (!setCookie) return
  const headers = Array.isArray(setCookie) ? setCookie : [setCookie]
  for (const h of headers) {
    const [pair] = h.split(';')
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (name) jar[name] = value
  }
}

function jarHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function readSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === 'function') return h.getSetCookie()
  const raw = res.headers.get('set-cookie')
  return raw ? [raw] : []
}

function extractHidden(html: string, name: string): string {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`)
  const m = html.match(re)
  return m ? m[1] : ''
}

async function login(username: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = {}

  const getRes = await fetch(LOGIN_URL, {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  updateJar(jar, readSetCookies(getRes))
  const loginHtml = await getRes.text()

  const body = new URLSearchParams({
    __EVENTTARGET: 'LnkLogin',
    __EVENTARGUMENT: '',
    __VIEWSTATE: extractHidden(loginHtml, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractHidden(loginHtml, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: extractHidden(loginHtml, '__EVENTVALIDATION'),
    Txt_Emp_User_Login: username,
    Txt_Emp_Pass: password,
  })

  const postRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      Referer: LOGIN_URL,
      Origin: 'https://www.twowayexpress.com',
      Cookie: jarHeader(jar),
    },
    body: body.toString(),
    redirect: 'manual',
  })
  updateJar(jar, readSetCookies(postRes))

  // ASP.NET redirects to /clienthome on success, /index on failure.
  const location = postRes.headers.get('location') || ''
  if (postRes.status >= 300 && postRes.status < 400 && !/client(home|orders)/i.test(location)) {
    throw new Error('فشل تسجيل الدخول — راجع اليوزر والباسوورد في متغيرات Vercel.')
  }

  return jar
}

type Row = { waybill: string; orderRef: string; status: string; statusDate: string }

function parseOrdersPage(html: string): Row[] {
  const rows: Row[] = []
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g
  let m: RegExpExecArray | null
  while ((m = trRegex.exec(html)) !== null) {
    const row = m[1]

    // Extract all <td> cells from this row
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const cells: string[] = []
    let td: RegExpExecArray | null
    while ((td = tdRegex.exec(row)) !== null) {
      cells.push(td[1])
    }

    // Need at least 3 cells (index, waybill, merchant code)
    if (cells.length < 3) continue

    // Column 2 (index 1): Waybill number — extract digits after checkbox
    const waybillCell = cells[1]
    const wMatch = waybillCell.match(/(\d{5,})/)
    if (!wMatch) continue
    const waybill = wMatch[1]

    // Column 3 (index 2): Merchant code (كود التاجر) — e.g. "#1047"
    const merchantCell = cells[2]
    const refMatch = merchantCell.match(/#?(\d+)/)
    const orderRef = refMatch ? refMatch[1] : ''

    // Shipping status is the LAST label-light-* span in the row.
    const labelRegex =
      /<span class=['"]\s*label\s+label-lg\s+label-light-[a-z]+\s+label-inline\s*['"]>([\s\S]*?)<\/span>/g
    let last: { text: string; date: string } | null = null
    let lm: RegExpExecArray | null
    while ((lm = labelRegex.exec(row)) !== null) {
      const content = lm[1]
      // Split by <br> to get status text and date
      const parts = content.split(/<br\s*\/?>/)
      last = { 
        text: (parts[0] || '').replace(/<[^>]*>/g, '').trim(), 
        date: (parts[1] || '').replace(/<[^>]*>/g, '').trim() 
      }
    }
    if (!last) continue
    rows.push({ waybill, orderRef, status: last.text, statusDate: last.date })
  }
  return rows
}

async function fetchOrdersPage(jar: CookieJar): Promise<string> {
  const res = await fetch(ORDERS_URL, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://www.twowayexpress.com/clienthome',
      Cookie: jarHeader(jar),
    },
    redirect: 'manual',
  })
  if (res.status !== 200) {
    throw new Error(`فشل جلب صفحة الشحنات (HTTP ${res.status}).`)
  }
  return res.text()
}

const GRID_POSTBACK_TARGET = 'ctl00$ArMainContent$UcClientOrders$GrdViewDtls'

function extractPageNumbers(html: string): number[] {
  // The pager row contains <a href="javascript:__doPostBack(...,'Page$N')">N</a>
  // and <span>N</span> for the current page.
  const pagerMatch = html.match(/<tr[^>]*>\s*<td[^>]*colspan[^>]*>([\s\S]*?)<\/td>\s*<\/tr>\s*<\/table>\s*<\/div>/)
  if (!pagerMatch) return []
  const pager = pagerMatch[1]
  const nums = new Set<number>()
  const re = /(?:Page\$(\d+)|<span>(\d+)<\/span>)/g
  let pm: RegExpExecArray | null
  while ((pm = re.exec(pager)) !== null) {
    const n = parseInt(pm[1] || pm[2], 10)
    if (n && !isNaN(n)) nums.add(n)
  }
  return Array.from(nums).sort((a, b) => a - b)
}

async function fetchPageN(jar: CookieJar, previousHtml: string, pageN: number): Promise<string> {
  const body = new URLSearchParams({
    __EVENTTARGET: GRID_POSTBACK_TARGET,
    __EVENTARGUMENT: `Page$${pageN}`,
    __VIEWSTATE: extractHidden(previousHtml, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractHidden(previousHtml, '__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: extractHidden(previousHtml, '__EVENTVALIDATION'),
  })
  const res = await fetch(ORDERS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      Referer: ORDERS_URL,
      Origin: 'https://www.twowayexpress.com',
      Cookie: jarHeader(jar),
    },
    body: body.toString(),
    redirect: 'manual',
  })
  if (res.status !== 200) {
    throw new Error(`فشل جلب الصفحة ${pageN} (HTTP ${res.status}).`)
  }
  updateJar(jar, readSetCookies(res))
  return res.text()
}

async function fetchAllRows(jar: CookieJar): Promise<Row[]> {
  const allRows: Row[] = []
  const seenWaybills = new Set<string>()
  const visitedPages = new Set<number>([1])

  let currentHtml = await fetchOrdersPage(jar)
  for (const r of parseOrdersPage(currentHtml)) {
    if (!seenWaybills.has(r.waybill)) {
      seenWaybills.add(r.waybill)
      allRows.push(r)
    }
  }

  const queue: number[] = extractPageNumbers(currentHtml).filter((n) => n > 1)

  while (queue.length > 0 && visitedPages.size < MAX_PAGES) {
    const pageN = queue.shift()!
    if (visitedPages.has(pageN)) continue
    visitedPages.add(pageN)

    currentHtml = await fetchPageN(jar, currentHtml, pageN)
    for (const r of parseOrdersPage(currentHtml)) {
      if (!seenWaybills.has(r.waybill)) {
        seenWaybills.add(r.waybill)
        allRows.push(r)
      }
    }
    for (const n of extractPageNumbers(currentHtml)) {
      if (n > 1 && !visitedPages.has(n) && !queue.includes(n)) queue.push(n)
    }
    queue.sort((a, b) => a - b)
  }

  return allRows
}

// ──────────────────────────────────────────────────────────────
// Search by order ID using the portal's native search field
// ──────────────────────────────────────────────────────────────
const SEARCH_POSTBACK_TARGET = 'ctl00$ArMainContent$UcClientOrders$TxtSearch'
const SEARCH_FIELD_NAME = 'ctl00$ArMainContent$UcClientOrders$TxtSearch'

async function searchByOrderId(
  jar: CookieJar,
  currentHtml: string,
  orderIdQuery: string,
): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      __EVENTTARGET: SEARCH_POSTBACK_TARGET,
      __EVENTARGUMENT: '',
      __VIEWSTATE: extractHidden(currentHtml, '__VIEWSTATE'),
      __VIEWSTATEGENERATOR: extractHidden(currentHtml, '__VIEWSTATEGENERATOR'),
      __EVENTVALIDATION: extractHidden(currentHtml, '__EVENTVALIDATION'),
      [SEARCH_FIELD_NAME]: orderIdQuery,
      'ctl00$ArMainContent$UcClientOrders$DDLLate': '0',
    })
    const res = await fetch(ORDERS_URL, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        Referer: ORDERS_URL,
        Origin: 'https://www.twowayexpress.com',
        Cookie: jarHeader(jar),
      },
      body: body.toString(),
      redirect: 'manual',
    })
    if (res.status !== 200) {
      console.warn(`Portal search returned HTTP ${res.status} — falling back to full scan.`)
      return null
    }
    updateJar(jar, readSetCookies(res))
    return res.text()
  } catch (err) {
    console.warn('Portal search failed:', err)
    return null
  }
}

// ──────────────────────────────────────────────────────────────
// Bulk sync: refresh ALL orders that have a waybill_number
// ──────────────────────────────────────────────────────────────
export async function syncShippingStatusesAction() {
  try {
    const username = process.env.SHIPPING_PORTAL_USERNAME
    const password = process.env.SHIPPING_PORTAL_PASSWORD
    if (!username || !password) {
      return {
        success: false,
        error:
          'يرجى ضبط SHIPPING_PORTAL_USERNAME و SHIPPING_PORTAL_PASSWORD في إعدادات Vercel.',
      }
    }

    const jar = await login(username, password)
    const rows = await fetchAllRows(jar)

    if (rows.length === 0) {
      return { success: true, updated: 0, scanned: 0, message: 'لم يتم العثور على شحنات.' }
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()
    let updated = 0

    const results = await Promise.all(
      rows.map((r) =>
        supabase
          .from('orders')
          .update({
            last_tracking_status: r.status,
            last_tracking_status_date: r.statusDate || null,
            last_tracking_check: now,
            shipping_company: 'twowayexpress',
          })
          .eq('waybill_number', r.waybill)
          .select('id'),
      ),
    )
    for (const r of results) {
      if (!r.error && r.data) updated += r.data.length
    }

    revalidatePath('/[lang]/orders', 'page')
    return { success: true, updated, scanned: rows.length }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    console.error('syncShippingStatusesAction error:', err)
    return { success: false, error: msg }
  }
}

// ──────────────────────────────────────────────────────────────
// Per-order tracking: search by the CRM order ID (external_order_id)
// ──────────────────────────────────────────────────────────────
export async function checkOrderShippingStatusAction(orderId: string) {
  try {
    const username = process.env.SHIPPING_PORTAL_USERNAME
    const password = process.env.SHIPPING_PORTAL_PASSWORD
    if (!username || !password) {
      return {
        success: false,
        error:
          'يرجى ضبط SHIPPING_PORTAL_USERNAME و SHIPPING_PORTAL_PASSWORD في إعدادات Vercel.',
      }
    }

    const supabase = createAdminClient()
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, external_order_id, waybill_number')
      .eq('id', orderId)
      .maybeSingle()
    if (oErr) return { success: false, error: `خطأ قاعدة البيانات: ${oErr.message}` }
    if (!order) return { success: false, error: 'الأوردر غير موجود.' }

    // Build search terms:
    // 1. external_order_id (e.g. Shopify "#1284")
    // 2. Short UUID (first 8 chars of UUID, shown as order ID in CRM)
    // 3. waybill_number
    const externalId = (order.external_order_id || '').replace(/^#/, '').trim()
    const shortId = String(order.id).substring(0, 8).toUpperCase()
    const waybill = (order.waybill_number || '').trim()
    
    // The search term to use on the portal
    const searchTerms = [externalId, shortId, waybill].filter(Boolean)
    
    if (searchTerms.length === 0) {
      return {
        success: false,
        error: 'الأوردر ليس له رقم طلب أو رقم بوليصة.',
      }
    }

    console.log(`[Shipping] Tracking order ${orderId}, search terms: ${searchTerms.join(', ')}`)

    const jar = await login(username, password)
    const firstPage = await fetchOrdersPage(jar)

    // Verify we're actually logged in (the page should contain the GridView)
    if (!firstPage.includes('GrdViewDtls') && !firstPage.includes('Chk_Row')) {
      // We might have been redirected to login page
      if (firstPage.includes('Txt_Emp_User_Login') || firstPage.includes('LnkLogin')) {
        return {
          success: false,
          error: 'فشل تسجيل الدخول — راجع اليوزر والباسوورد في إعدادات Vercel.',
        }
      }
      return {
        success: false,
        error: 'لم يتم التعرف على صفحة الشحنات — قد يكون البورتال معطل.',
      }
    }

    // STEP 1: Full scan — fetch ALL pages with clean session (most reliable)
    console.log(`[Shipping] Scanning all portal pages...`)
    const allRows = await fetchAllRows(jar)
    console.log(`[Shipping] Found ${allRows.length} total shipments across all pages`)

    let matches: Row[] = []

    // Match by waybill first
    if (waybill) {
      matches = allRows.filter((r) => r.waybill === waybill)
    }
    // Then by external order ID (merchant code like #1075)
    if (matches.length === 0 && externalId) {
      matches = allRows.filter((r) => r.orderRef === externalId)
    }

    if (matches.length === 0) {
      // Build diagnostic error
      const total = allRows.length
      const samples = allRows.slice(0, 8).map(r => `${r.waybill}=#${r.orderRef}`).join(', ')
      return {
        success: false,
        error: `لم يتم العثور على الطلب.\nبحث: ${searchTerms.join(' / ')}\nإجمالي شحنات البورتال: ${total}\nعينة: ${samples || 'لا توجد شحنات'}`,
      }
    }

    const row = matches[0]
    const now = new Date().toISOString()

    // Save tracking info + waybill number (in case we discovered it)
    const updatePayload: Record<string, unknown> = {
      last_tracking_status: row.status,
      last_tracking_status_date: row.statusDate || null,
      last_tracking_check: now,
      shipping_company: 'twowayexpress',
    }
    // If we didn't have a waybill before, save the one we found
    if (!waybill && row.waybill) {
      updatePayload.waybill_number = row.waybill
    }

    const { error: uErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
    
    if (uErr) {
      // If columns don't exist yet, strip them and retry
      if (/column .* does not exist/i.test(uErr.message || '')) {
        return { success: false, error: 'يرجى تشغيل migration الشحن في Supabase أولاً.' }
      }
      return { success: false, error: `تعذّر حفظ الحالة: ${uErr.message}` }
    }

    revalidatePath('/[lang]/orders', 'page')
    return {
      success: true,
      status: row.status,
      statusDate: row.statusDate,
      waybill: row.waybill,
      checkedAt: now,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    console.error('checkOrderShippingStatusAction error:', err)
    return { success: false, error: msg }
  }
}
