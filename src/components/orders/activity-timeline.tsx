'use client'
import { CheckCircle2, Package, Truck, User } from 'lucide-react'

const getEvents = (lang: string) => [
  { id: 1, action: lang === 'ar' ? "تم إنشاء الطلب" : "Order Created", by: lang === 'ar' ? "نظام (Shopify)" : "System (Shopify)", time: "10:30 AM, Oct 24", icon: Package, color: "text-blue-500" },
  { id: 2, action: lang === 'ar' ? "تم التحديث إلى: مؤكد" : "Status updated to Confirmed", by: "Moderator: Sara", time: "11:15 AM, Oct 24", icon: CheckCircle2, color: "text-green-500" },
  { id: 3, action: lang === 'ar' ? "تم التحديث إلى: تم الشحن" : "Status updated to Shipped", by: "Moderator: Ahmed", time: "09:00 AM, Oct 25", icon: Truck, color: "text-orange-500" },
]

export function ActivityTimeline({ dict, lang }: { dict: any, lang: string }) {
  const isRTL = lang === 'ar'
  const events = getEvents(lang)

  return (
    <div className={`relative ${isRTL ? 'border-r-2 mr-3 pr-6' : 'border-l-2 ml-3 pl-6'} border-border space-y-8 pt-2 pb-4`}>
      {events.map((event) => (
        <div
          key={event.id}
          className="relative"
        >
          <div className={`absolute ${isRTL ? '-right-[40px]' : '-left-[40px]'} bg-background p-1.5 rounded-full ring-4 ring-background border border-border`}>
            <event.icon className={`w-4 h-4 ${event.color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{event.action}</p>
            <div className={`flex items-center gap-2 mt-1.5 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
              <span className="text-xs text-muted-foreground font-medium" dir="ltr">{event.time}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{event.by}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
