import { Activity, Gauge, Power, Receipt, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import StatCard from '@/components/StatCard'
import ActivityFeed from '@/components/ActivityFeed'
import TrendChart from '@/components/TrendChart'
import { LOW_BAL_WARN, TARIFF_RATE, naira } from '@/lib/constants'
import { cn } from '@/lib/utils'

const BARS = ['bg-accent', 'bg-primary', 'bg-emerald-500']

export default function BuildingOverview({ flats, history = [], samples = [] }) {
  const totalPower = flats.reduce((s, f) => (f.relayOn ? s + f.meter.powerW : s), 0)
  const totalDaily = flats.reduce((s, f) => s + f.dailyEnergy, 0)
  const online = flats.filter((f) => f.relayOn).length

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Gauge} tone="accent" label="Total load" value={Math.round(totalPower)} unit="W" sub="live across building" />
        <StatCard icon={Activity} label="Energy today" value={totalDaily.toFixed(2)} unit="kWh" sub="all flats combined" />
        <StatCard icon={Receipt} label="Billed today" value={naira(totalDaily * TARIFF_RATE, 0)} sub={`at ${naira(TARIFF_RATE, 0)}/kWh`} />
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
                <Badge variant={f.relayOn ? 'success' : 'destructive'}>
                  <Power className="mr-1 h-3 w-3" />
                  {f.relayOn ? 'ON' : 'OFF'}
                </Badge>
              </div>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={cn('num text-3xl font-bold tracking-tight', low ? 'text-destructive' : 'text-foreground')}>
                    {naira(f.balance)}
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
                    <p className="text-xs text-muted-foreground">Usage today</p>
                    <p className="num font-semibold">{f.dailyEnergy.toFixed(3)} kWh</p>
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
    </div>
  )
}
