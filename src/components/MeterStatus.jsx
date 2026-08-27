import { Radio, WifiOff, Clock3, AlertTriangle, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { FRESHNESS } from '@/lib/freshness'

// Per-flat freshness badge. Deliberately per-flat rather than one global
// banner: lastUpdated is written per flat, so one can go quiet while the others
// keep reporting, and a single building-wide indicator would hide that.
const styles = {
  [FRESHNESS.FRESH]: { variant: 'success', Icon: Radio },
  [FRESHNESS.DELAYED]: { variant: 'warning', Icon: Clock3 },
  [FRESHNESS.STALE]: { variant: 'destructive', Icon: WifiOff },
  [FRESHNESS.UNSYNCED]: { variant: 'secondary', Icon: Clock3 },
  [FRESHNESS.SKEW]: { variant: 'warning', Icon: AlertTriangle },
  [FRESHNESS.UNKNOWN]: { variant: 'outline', Icon: HelpCircle },
}

export default function MeterStatus({ freshness, showAge = false, className }) {
  const { variant, Icon } = styles[freshness.state] ?? styles[FRESHNESS.UNKNOWN]
  return (
    <Badge
      variant={variant}
      className={cn('gap-1.5', className)}
      title={freshness.detail}
    >
      <Icon
        className={cn(
          'h-3 w-3',
          // Only a genuinely live meter pulses. A stale badge must never look
          // like activity.
          freshness.state === FRESHNESS.FRESH && 'animate-pulse'
        )}
      />
      {freshness.label}
      {showAge && freshness.ageMs != null && freshness.state !== FRESHNESS.FRESH && (
        <span className="font-normal opacity-80">
          · {Math.round(freshness.ageMs / 1000)}s
        </span>
      )}
    </Badge>
  )
}
