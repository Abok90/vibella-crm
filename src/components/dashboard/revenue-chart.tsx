'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function RevenueChart({ dict, lang, data }: { dict: any; lang: string; data: any[] }) {
  const isRTL = lang === 'ar'

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const rev = payload.find((p: any) => p.dataKey === 'revenue')?.value || 0
    const cogs = payload.find((p: any) => p.dataKey === 'cogs')?.value || 0
    const profit = rev - cogs
    return (
      <div className="bg-card/95 backdrop-blur border border-border rounded-xl px-3 py-2.5 shadow-lg text-[12px] min-w-[140px]">
        <p className="font-semibold text-foreground mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-mono font-semibold">{Number(p.value).toLocaleString()}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">{isRTL ? 'الربح' : 'Profit'}</span>
          </div>
          <span className={`font-mono font-bold ${profit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
            {profit.toLocaleString()}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-[14px] p-4 md:p-5 w-full h-[280px] md:h-[360px]">
      <h3 className="ios-headline text-foreground mb-3">
        {isRTL ? 'المبيعات مقابل التكلفة (7 أيام)' : 'Sales vs COGS (7 days)'}
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false} tickLine={false}
            orientation={isRTL ? 'right' : 'left'}
            dx={isRTL ? 8 : -8}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent)', opacity: 0.3 }} />
          <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '13px' }} iconType="circle" />
          <Bar dataKey="revenue" name={isRTL ? 'المبيعات' : 'Sales'} fill="#34C759" radius={[6, 6, 0, 0]} maxBarSize={32} />
          <Bar dataKey="cogs" name={isRTL ? 'التكلفة' : 'COGS'} fill="#FF3B30" radius={[6, 6, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
