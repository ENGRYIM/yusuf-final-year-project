import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function CustomTooltip({ active, payload, label, unit, formatter }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground">{p.name}</span>
          <span className="num ml-auto font-semibold text-foreground">
            {formatter ? formatter(p.value) : p.value}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// data: [{ t, <key>: number, ... }], series: [{ key, label, color }]
export default function TrendChart({ data, series, unit, formatter, height = 180 }) {
  const empty = data.length < 2
  return (
    <div style={{ height }} className="w-full">
      {empty ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Collecting data…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} formatter={formatter} />}
              cursor={{ stroke: 'hsl(var(--border))' }}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                isAnimationActive={false}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
