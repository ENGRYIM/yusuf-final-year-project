import {
  Activity,
  Gauge,
  Lock,
  Power,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import StatCard from '@/components/StatCard'
import ActivityFeed from '@/components/ActivityFeed'
import TrendChart from '@/components/TrendChart'
import MonthlyHistory from '@/components/MonthlyHistory'
import MeterStatus from '@/components/MeterStatus'
import SimulatedBadge from '@/components/SimulatedBadge'
import useNow from '@/hooks/useNow'
import { meterFreshness } from '@/lib/freshness'
import {
  DEFAULT_FLAT_PIN,
  LOW_BAL_WARN,
  TARIFF_LABEL,
  costOf,
  kwh,
  naira,
  unitsFor,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

const BARS = ['bg-accent', 'bg-primary', 'bg-emerald-500']

// Administrator-only view: it aggregates every flat, so App only renders it once
// the admin PIN has been accepted.
export default function BuildingOverview({
  flats,
  history = [],
  samples = [],
  onLock,
  onResetPins,
}) {
  const now = useNow()
  // Per-flat, not building-wide: lastUpdated is written per flat, so one meter
  // can go quiet while the rest keep reporting.
  const freshnessById = Object.fromEntries(
    flats.map((f) => [f.id || f.name, meterFreshness(f.lastUpdated, now)])
  )

  const totalPower = flats.reduce((s, f) => (f.relayOn ? s + f.meter.powerW : s), 0)
  const totalDaily = flats.reduce((s, f) => s + f.dailyEnergy, 0)
  const totalConsumed = flats.reduce((s, f) => s + f.totalEnergy, 0)
  const online = flats.filter((f) => f.relayOn).length

  return (
    <div className="space-y-6">
      {/* Admin session bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="success">
          <ShieldCheck className="mr-1 h-3 w-3" /> Administrator session
        </Badge>
        {onLock && (
          <Button variant="outline" size="sm" onClick={onLock}>
            <Lock className="h-4 w-4" /> Lock monitor
          </Button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Gauge} tone="accent" label="Total load" value={Math.round(totalPower)} unit="W" sub="live across building" />
        <StatCard icon={Activity} label="Energy consumed" value={totalConsumed.toFixed(2)} unit="kWh" sub={`${totalDaily.toFixed(2)} kWh today · all flats`} />
        <StatCard icon={Receipt} label="Billed" value={naira(costOf(totalConsumed), 0)} sub={`at ${TARIFF_LABEL}`} />
        <StatCard icon={Power} tone={online === flats.length ? 'success' : 'danger'} label="Flats online" value={`${online}/${flats.length}`} sub="power connected" />
      </div>

      {/* Load distribution */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Load distribution</p>
            <p className="num text-xs text-muted-foreground">{Math.round(totalPower)} W total</p>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {flats.map((f, i) => {
              const share = totalPower > 0 && f.relayOn ? (f.meter.powerW / totalPower) * 100 : 0
              return (
                <div
                  key={f.name}
                  className={cn('h-full transition-all', BARS[i])}
                  style={{ width: `${share}%` }}
                  title={`${f.name}: ${Math.round(f.meter.powerW)} W`}
                />
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {flats.map((f, i) => (
              <span key={f.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-2.5 w-2.5 rounded-sm', BARS[i])} />
                {f.name} · <span className="num text-foreground">{f.relayOn ? Math.round(f.meter.powerW) : 0} W</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Consumption trend */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Consumption trend</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={samples}
            series={[{ key: 'load', label: 'Total load', color: '#f59e0b' }]}
            unit="W"
            height={200}
          />
        </CardContent>
      </Card>

      {/* Flat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {flats.map((f) => {
          const low = f.balance > 0 && f.balance <= LOW_BAL_WARN
          return (
            <Card key={f.name} className={cn('overflow-hidden', !f.relayOn && 'opacity-90')}>
              <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
                <span className="flex items-center gap-2 font-semibold">
                  <Zap className="h-4 w-4 text-accent" />
                  {f.name}
                </span>
                <span className="flex items-center gap-1.5">
                  <SimulatedBadge live={f.meterLive} />
                  <MeterStatus freshness={freshnessById[f.id || f.name]} />
                  <Badge variant={f.relayOn ? 'success' : 'destructive'}>
                    <Power className="mr-1 h-3 w-3" />
                    {f.relayOn ? 'ON' : 'OFF'}
                  </Badge>
                </span>
              </div>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={cn('num text-3xl font-bold tracking-tight', low ? 'text-destructive' : 'text-foreground')}>
                    {naira(f.balance)}
                  </p>
                  <p className="num mt-0.5 text-xs text-muted-foreground">
                    {kwh(unitsFor(f.balance))} of units left
                  </p>
                  <Progress
                    value={Math.min(100, (f.balance / 500) * 100)}
                    className="mt-2.5"
                    indicatorClassName={low ? 'bg-destructive' : 'bg-accent'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Live power</p>
                    <p className="num font-semibold">{f.relayOn ? Math.round(f.meter.powerW) : 0} W</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Energy consumed</p>
                    <p className="num font-semibold">{f.totalEnergy.toFixed(3)} kWh</p>
                    <p className="num text-[11px] text-muted-foreground">
                      {f.dailyEnergy.toFixed(3)} kWh today
                    </p>
                  </div>
                </div>
                {f.emergencyUsed && (
                  <Badge variant="warning" className="w-full justify-center">
                    Emergency credit — owes {naira(f.emergencyOwed)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Building activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Building activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ActivityFeed
            entries={history.slice(0, 12)}
            flats={flats}
            showFlat
            emptyHint="Transactions across all flats will show here"
          />
        </CardContent>
      </Card>

      {/* Monthly history, per flat — read from flats/<id>/monthly in RTDB */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {flats.map((f) => (
            <div key={f.id || f.name}>
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-accent" />
                {f.name}
              </p>
              <MonthlyHistory rows={f.monthly} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Demo aid: these PINs used to be printed on the public login screen, which
          let any tenant sign into any flat. Only the factory default is shown — a
          PIN the tenant has since chosen is theirs, and not the landlord's to read. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tenant PINs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-3 text-xs text-muted-foreground">
            A flat still on the factory PIN ({DEFAULT_FLAT_PIN}) is flagged here. Once
            a tenant sets their own, it is theirs — not readable by anyone, including
            you. Resetting is the only way back in if one is forgotten.
          </p>
          <div className="flex flex-wrap gap-2">
            {flats.map((f) => {
              const changed = f.pin !== DEFAULT_FLAT_PIN
              return (
                <span
                  key={f.id || f.name}
                  className="rounded-lg border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  {f.name} ·{' '}
                  {changed ? (
                    <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" /> set by tenant
                    </span>
                  ) : (
                    <b className="num text-foreground">{DEFAULT_FLAT_PIN}</b>
                  )}
                </span>
              )
            })}
          </div>
          {onResetPins && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-muted-foreground"
              onClick={onResetPins}
            >
              <RotateCcw className="h-4 w-4" /> Reset all tenant PINs
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
