'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

export function RealtimeProvider() {
  const router = useRouter()
  const { showToast } = useToast()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const supabase = createClient()
    
    const handler = (payload: any) => {
      let msg = "تم تحديث البيانات للتو";
      let table = payload.table;
      let action = payload.eventType; // INSERT, UPDATE, DELETE

      if (table === 'orders') msg = action === 'INSERT' ? "تم استلام طلب جديد" : "تم تعديل طلب في النظام";
      if (table === 'customers') msg = "تم تحديث قائمة العملاء";
      if (table === 'transactions') msg = "تم تحديث المعاملات المالية";

      showToast(msg, 'info')

      // Debounce rapid updates
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        // Force Next.js to re-fetch Server Components
        router.refresh()
      }, 800)
    }

    const channel = supabase
      .channel('system_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handler)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, handler)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, handler)
      .subscribe((status, err) => {
        console.log('Supabase real-time status:', status, err);
        if (status === 'SUBSCRIBED') {
           console.log("Connected to Realtime");
        }
      })

    return () => {
      supabase.removeChannel(channel)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [router, showToast])

  return null
}
