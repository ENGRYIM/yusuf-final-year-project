import { FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Shown when flats/<id>/meterLive is false: the voltage, current and power on
// screen are the firmware's simulated load, not a PZEM reading.
//
// Deliberately visible rather than a footnote. Every other number here is real —
// balances move, credit is spent, the relay actually opens — so simulated
// readings sitting among them are the one thing a viewer could reasonably
// mistake for a measurement. The firmware detects the sensors per flat and
// flips this by itself once they are wired, so the badge disappears on its own.
//
// `live === null` means the device did not say. That is left unlabelled: an
// unknown must not be dressed up as either measured or simulated.
export default function SimulatedBadge({ live, className }) {
  if (live !== false) return null
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 border-dashed', className)}
      title="Voltage, current and power are simulated by the firmware — no PZEM sensor is attached to this flat. Balances, credit and relay state are real."
    >
      <FlaskConical className="h-3 w-3" />
      Simulated readings
    </Badge>
  )
}
