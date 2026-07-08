import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const tones = {
  default: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  danger: 'bg-destructive/10 text-destructive',
}

export default function StatCard({ icon: Icon, label, value, unit, sub, tone = 'default' }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            tones[tone]
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="num text-2xl font-bold leading-none tracking-tight sm:text-[28px]">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        )}
      </div>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}
