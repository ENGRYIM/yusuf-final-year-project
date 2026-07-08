import {
  ArrowDownLeft,
  ArrowUpRight,
  BatteryWarning,
  KeyRound,
  Plus,
  PlugZap,
  PowerOff,
  Inbox,
} from 'lucide-react'
import { naira } from '@/lib/constants'
import { cn } from '@/lib/utils'

const META = {
  recharge: { icon: Plus, label: 'Recharge', tone: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  transfer_in: { icon: ArrowDownLeft, label: 'Received from', tone: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  transfer_out: { icon: ArrowUpRight, label: 'Sent to', tone: 'text-destructive', sign: '−' },
  borrow: { icon: BatteryWarning, label: 'Emergency borrow', tone: 'text-accent', sign: '+' },
  power_on: { icon: PlugZap, label: 'Power restored', tone: 'text-emerald-600 dark:text-emerald-400', sign: '' },
  power_off: { icon: PowerOff, label: 'Power disconnected', tone: 'text-destructive', sign: '' },
  pin_change: { icon: KeyRound, label: 'PIN updated', tone: 'text-muted-foreground', sign: '' },
}

const time = (ts) =>
  new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

export default function ActivityFeed({ entries, flats, showFlat = false, emptyHint }) {
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
        <Inbox className="h-8 w-8 opacity-50" />
        <p className="text-sm">{emptyHint || 'No activity yet'}</p>
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {entries.map((e) => {
        const m = META[e.type]
        const Icon = m.icon
        return (
          <li key={e.id} className="flex items-center gap-3 py-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted',
                m.tone
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.label}
                {e.note ? ` ${e.note}` : ''}
                {showFlat && (
                  <span className="text-muted-foreground"> · {flats[e.flat].name}</span>
                )}
              </p>
              <p className="num text-xs text-muted-foreground">{time(e.ts)}</p>
            </div>
            {e.amount > 0 && (
              <span className={cn('num shrink-0 text-sm font-semibold', m.tone)}>
                {m.sign}
                {naira(e.amount)}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
