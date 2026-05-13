'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Play, Pause, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type BatchResult = {
  orderId: string
  externalId: string
  status: 'ok' | 'skipped' | 'error'
  reason?: string
}

type Mode = 'orphans' | 'all'

const BATCH_SIZE = 5

export default function ShopifyBackfillPanel({ lang }: { lang: string }) {
  const ar = lang === 'ar'

  const [mode, setMode] = useState<Mode>('all')
  const [orphans, setOrphans] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [processedCount, setProcessedCount] = useState(0)
  const [succeeded, setSucceeded] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [failed, setFailed] = useState(0)
  const [recentErrors, setRecentErrors] = useState<BatchResult[]>([])
  const [loadingCount, setLoadingCount] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const stopRef = useRef(false)

  async function refreshCount() {
    setLoadingCount(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/admin/backfill-shopify-customers', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg(ar ? `خطأ: ${data.error || res.status}` : `Error: ${data.error || res.status}`)
        return
      }
      setOrphans(data.orphans ?? 0)
      setTotal(data.total ?? 0)
    } catch (err: any) {
      setStatusMsg(ar ? `خطأ في الاتصال: ${err.message}` : `Network error: ${err.message}`)
    } finally {
      setLoadingCount(false)
    }
  }

  useEffect(() => {
    refreshCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    if (running) return
    stopRef.current = false
    setRunning(true)
    setProcessedCount(0)
    setSucceeded(0)
    setSkipped(0)
    setFailed(0)
    setRecentErrors([])
    setStatusMsg(null)

    let cursor: string | null = null

    while (!stopRef.current) {
      try {
        const res: Response = await fetch('/api/admin/backfill-shopify-customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: BATCH_SIZE, mode, before: cursor }),
        })
        const data = await res.json()
        if (!res.ok) {
          setStatusMsg(ar ? `خطأ: ${data.error || res.status}` : `Error: ${data.error || res.status}`)
          break
        }
        const batchOk: number = data.succeeded || 0
        const batchFail: number = data.failed || 0
        const batchProcessed: number = data.processed || 0
        const batchSkipped: number = (data.results || []).filter((r: BatchResult) => r.status === 'skipped').length

        setProcessedCount((p: number) => p + batchProcessed)
        setSucceeded((s: number) => s + batchOk - batchSkipped)
        setSkipped((sk: number) => sk + batchSkipped)
        setFailed((f: number) => f + batchFail)

        const errs: BatchResult[] = (data.results || []).filter((r: BatchResult) => r.status === 'error')
        if (errs.length) setRecentErrors((prev: BatchResult[]) => [...errs, ...prev].slice(0, 10))

        // Refresh the orphans/total counters live
        if (data.orphans !== undefined) setOrphans(data.orphans)

        if (mode === 'orphans') {
          setOrphans(data.remaining ?? 0)
          if (!batchProcessed || data.remaining === 0) break
        } else {
          cursor = data.nextCursor || null
          if (!batchProcessed || !cursor) break
        }
      } catch (err: any) {
        setStatusMsg(ar ? `خطأ في الاتصال: ${err.message}` : `Network error: ${err.message}`)
        break
      }
    }

    setRunning(false)
    // Final refresh
    refreshCount()
  }

  function stop() {
    stopRef.current = true
  }

  const baseline = mode === 'orphans' ? orphans ?? 0 : total ?? 0
  const done = processedCount
  const percent = baseline > 0 ? Math.min(100, Math.round((done / baseline) * 100)) : 0

  return (
    <div className="bg-card rounded-[14px] overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h4 className="ios-body font-semibold text-foreground">
          {ar ? 'إصلاح طلبات شوبيفاي القديمة' : 'Backfill old Shopify orders'}
        </h4>
        <p className="ios-caption text-muted-foreground mt-1">
          {ar
            ? 'يجيب اسم وهاتف وعنوان العميل من شوبيفاي للطلبات القديمة. مش هيمسح أي بيانات موجودة — بس يملي الفاضي.'
            : 'Re-fetches name/phone/address from Shopify for old orders. Never overwrites existing data — only fills empty fields.'}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="px-4 py-3 border-b border-border">
        <p className="ios-caption text-muted-foreground mb-2">
          {ar ? 'النطاق' : 'Scope'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => !running && setMode('all')}
            disabled={running}
            className={cn(
              'px-3 py-2 rounded-[10px] text-[12px] font-semibold border-2 transition-all',
              mode === 'all'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent/40',
              running && 'opacity-60 cursor-not-allowed',
            )}
          >
            {ar ? 'كل طلبات شوبيفاي' : 'All Shopify orders'}
            {total !== null && <span className="block text-[10px] font-normal opacity-75 mt-0.5">{total.toLocaleString()}</span>}
          </button>
          <button
            onClick={() => !running && setMode('orphans')}
            disabled={running}
            className={cn(
              'px-3 py-2 rounded-[10px] text-[12px] font-semibold border-2 transition-all',
              mode === 'orphans'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent/40',
              running && 'opacity-60 cursor-not-allowed',
            )}
          >
            {ar ? 'بدون عميل فقط' : 'Missing customer only'}
            {orphans !== null && <span className="block text-[10px] font-normal opacity-75 mt-0.5">{orphans.toLocaleString()}</span>}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="ios-body text-foreground">
            {mode === 'orphans'
              ? ar ? 'طلبات بدون عميل' : 'Orders missing customer'
              : ar ? 'إجمالي طلبات شوبيفاي' : 'Total Shopify orders'}
          </span>
          <div className="flex items-center gap-2">
            <span className="ios-body font-semibold text-foreground tabular-nums">
              {baseline.toLocaleString()}
            </span>
            <button
              onClick={refreshCount}
              disabled={loadingCount || running}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-50"
              title={ar ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingCount && 'animate-spin')} />
            </button>
          </div>
        </div>

        {(running || done > 0) && baseline > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>
                {ar ? 'تم' : 'Done'}: {done.toLocaleString()} / {baseline.toLocaleString()}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-1.5 bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex gap-3 mt-2 text-[11px]">
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {succeeded.toLocaleString()}
              </span>
              {skipped > 0 && (
                <span className="text-muted-foreground">
                  {ar ? 'تم تخطّيها' : 'skipped'}: {skipped.toLocaleString()}
                </span>
              )}
              {failed > 0 && (
                <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {failed.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {recentErrors.length > 0 && (
        <div className="px-4 py-3 border-b border-border space-y-1.5 max-h-40 overflow-y-auto">
          <p className="ios-caption text-muted-foreground mb-1">
            {ar ? 'آخر الأخطاء:' : 'Recent errors:'}
          </p>
          {recentErrors.map((e: BatchResult, i: number) => (
            <div key={i} className="text-[11px] text-red-600 dark:text-red-400 font-mono break-all">
              {e.externalId}: {e.reason}
            </div>
          ))}
        </div>
      )}

      {statusMsg && (
        <div className="px-4 py-2 border-b border-border text-[12px] text-amber-600 dark:text-amber-400">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1">
        {!running ? (
          <button
            onClick={start}
            disabled={baseline === 0}
            className="flex items-center justify-center gap-2 py-3 ios-body font-semibold text-primary active:bg-accent/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {ar ? 'بدء الإصلاح' : 'Start backfill'}
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex items-center justify-center gap-2 py-3 ios-body font-semibold text-amber-600 dark:text-amber-400 active:bg-accent/60 transition-colors"
          >
            <Pause className="w-4 h-4" />
            {ar ? 'إيقاف' : 'Stop'}
          </button>
        )}
      </div>
    </div>
  )
}
