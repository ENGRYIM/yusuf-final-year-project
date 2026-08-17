import { AlertTriangle, DatabaseZap, Loader2, PlugZap, Settings } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { STATUS } from '@/hooks/useEnergySystem'

// Shown wherever flat data would go while there is none. The dashboard never
// invents readings, so this panel says exactly why the screen is empty and what
// would fill it.
const STATES = {
  [STATUS.CONNECTING]: {
    icon: Loader2,
    spin: true,
    title: 'Connecting to the meter',
    body: 'Opening the Realtime Database stream…',
  },
  [STATUS.WAITING]: {
    icon: PlugZap,
    title: 'Waiting for meter data',
    body:
      'Connected, but the meter has not published anything yet. Flats appear here the moment the device writes to the flats node.',
  },
  [STATUS.UNCONFIGURED]: {
    icon: Settings,
    title: 'Firebase is not configured',
    body:
      'Copy .env.example to .env.local and fill in the VITE_FIREBASE_* values from your Firebase project, then restart the dev server.',
  },
  [STATUS.ERROR]: {
    icon: AlertTriangle,
    tone: 'danger',
    title: 'Could not read the meter data',
    body:
      'The Realtime Database read failed. Check the database rules, the database URL, and this device’s network connection.',
  },
}

export default function ConnectionState({ status, errorMsg, className }) {
  const state = STATES[status]
  if (!state) return null
  const Icon = state.icon
  const danger = state.tone === 'danger'

  return (
    <div className={className}>
      <Card className="mx-auto flex max-w-lg flex-col items-center p-8 text-center sm:p-10">
        <div
          className={
            danger
              ? 'flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive'
              : 'flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent'
          }
        >
          <Icon className={state.spin ? 'h-6 w-6 animate-spin' : 'h-6 w-6'} />
        </div>
        <h2 className="mt-5 text-lg font-bold">{state.title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{state.body}</p>

        {errorMsg && (
          <p className="mt-3 max-w-md break-words rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {errorMsg}
          </p>
        )}

        {status === STATUS.WAITING && (
          <div className="mt-5 w-full max-w-md rounded-lg border bg-muted/40 p-3 text-left">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <DatabaseZap className="h-3.5 w-3.5" /> Expected shape
            </p>
            <pre className="num mt-2 overflow-x-auto text-[11px] leading-relaxed text-muted-foreground">
{`flats/
  flat1/
    name, balance, relayOn
    voltage, current, powerW
    dailyEnergy, totalEnergy
    monthly/2026-08/
      energyKWh, billed, recharged`}
            </pre>
          </div>
        )}
      </Card>
    </div>
  )
}
