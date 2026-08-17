import { useState } from 'react'
import {
  Activity,
  ArrowLeftRight,
  BatteryWarning,
  Clock,
  Gauge,
  LogOut,
  Plus,
  Power,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StatCard from '@/components/StatCard'
import ActivityFeed from '@/components/ActivityFeed'
import TrendChart from '@/components/TrendChart'
import ChangePinDialog from '@/components/ChangePinDialog'
import {
  EMERGENCY_AMT,
  LOW_BAL_WARN,
  TARIFF_LABEL,
  costOf,
  kwh,
  naira,
  unitsFor,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

// Tenant portal. It is handed only the signed-in flat (`flat`), a names-only
// `directory` for choosing a transfer recipient, and that flat's own history and
// chart samples — no other flat's figures are in scope here.
export default function Dashboard({
  flat: f,
  flatIndex,
  directory,
  history,
  samples,
  actions,
  onLogout,
}) {
  const [rechargeAmt, setRechargeAmt] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmt, setTransferAmt] = useState('')

  const low = f.balance > 0 && f.balance <= LOW_BAL_WARN
  const balancePct = Math.min(100, (f.balance / 500) * 100)
  // Credit expressed the way a prepaid meter sells it: kWh at the tariff.
  const unitsLeft = unitsFor(f.balance)
  // An open relay draws nothing, whatever the last reading said.
  const livePower = f.relayOn ? f.meter.powerW : 0
  const liveCurrent = f.relayOn ? f.meter.current : 0
  const runtime = livePower > 0 ? unitsLeft / (livePower / 1000) : null
  const rechargeUnits = Number(rechargeAmt) > 0 ? unitsFor(Number(rechargeAmt)) : 0

  const others = directory.filter((d) => d.i !== flatIndex)

  const submitRecharge = () => {
    if (actions.recharge(flatIndex, rechargeAmt)) setRechargeAmt('')
  }
  const submitTransfer = () => {
    if (transferTo === '') return
    if (actions.transfer(flatIndex, Number(transferTo), transferAmt)) setTransferAmt('')
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">{f.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={f.relayOn ? 'success' : 'destructive'}>
                <Power className="mr-1 h-3 w-3" />
                {f.relayOn ? 'Power ON' : 'Disconnected'}
              </Badge>
              {f.emergencyUsed && <Badge variant="warning">Owes {naira(f.emergencyOwed)}</Badge>}
              {low && <Badge variant="destructive">Low balance</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChangePinDialog
            flatIndex={flatIndex}
            flatName={f.name}
            changePin={actions.changePin}
          />
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: overview */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          {/* Balance hero */}
          <Card className="overflow-hidden">
            <div className="bg-grid relative bg-primary p-6 text-primary-foreground sm:p-7">
              <p className="text-sm text-primary-foreground/70">Available credit</p>
              <p className="num mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
                {naira(f.balance)}
              </p>
              <p className="num mt-1.5 text-sm font-semibold text-accent">
                {kwh(unitsLeft)} of units remaining
              </p>
              <Progress
                value={balancePct}
                className="mt-5 bg-white/15"
                indicatorClassName={low ? 'bg-destructive' : 'bg-accent'}
              />
              <p className="mt-2 text-xs text-primary-foreground/60">
                Tariff {TARIFF_LABEL} · warns below {naira(LOW_BAL_WARN)}
              </p>
            </div>
          </Card>

          {/* Live stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Gauge}
              tone="accent"
              label="Live power"
              value={Math.round(livePower)}
              unit="W"
              sub={
                f.relayOn
                  ? `${f.meter.voltage} V · ${liveCurrent} A`
                  : 'relay open — no load'
              }
            />
            <StatCard
              icon={Activity}
              label="Energy consumed"
              value={f.totalEnergy.toFixed(3)}
              unit="kWh"
              sub={`${f.dailyEnergy.toFixed(3)} kWh today · ${naira(costOf(f.totalEnergy), 0)} billed`}
            />
            <StatCard
              icon={Clock}
              tone={low ? 'danger' : 'default'}
              label="Est. runtime"
              value={runtime !== null ? runtime.toFixed(1) : '—'}
              unit={runtime !== null ? 'h' : ''}
              sub="at current load"
            />
          </div>

          {/* Trends */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-base">Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="energy">
                <TabsList className="mb-3 grid w-full grid-cols-3 sm:w-[320px]">
                  <TabsTrigger value="energy">Energy</TabsTrigger>
                  <TabsTrigger value="power">Load</TabsTrigger>
                  <TabsTrigger value="credit">Credit</TabsTrigger>
                </TabsList>
                <TabsContent value="energy">
                  <TrendChart
                    data={samples}
                    series={[{ key: 'energy', label: 'Consumed', color: '#10b981' }]}
                    unit="kWh"
                    formatter={(v) => Number(v).toFixed(3)}
                    height={180}
                  />
                </TabsContent>
                <TabsContent value="power">
                  <TrendChart
                    data={samples}
                    series={[{ key: 'power', label: 'Live load', color: '#3b82f6' }]}
                    unit="W"
                    height={180}
                  />
                </TabsContent>
                <TabsContent value="credit">
                  <TrendChart
                    data={samples}
                    series={[{ key: 'balance', label: 'Balance', color: '#f59e0b' }]}
                    formatter={(v) => naira(v, 0)}
                    height={180}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ActivityFeed
                entries={history}
                emptyHint="Your recharges, transfers and alerts appear here"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: actions */}
        <div className="lg:col-span-5 xl:col-span-4">
          <Card className="lg:sticky lg:top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Manage credit</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="recharge">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="recharge">
                    <Plus className="mr-1 h-4 w-4" /> Top up
                  </TabsTrigger>
                  <TabsTrigger value="transfer">
                    <ArrowLeftRight className="mr-1 h-4 w-4" /> Send
                  </TabsTrigger>
                  <TabsTrigger value="borrow">
                    <BatteryWarning className="mr-1 h-4 w-4" /> Borrow
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="recharge" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rAmt">Amount (₦)</Label>
                    <Input
                      id="rAmt"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="e.g. 200"
                      value={rechargeAmt}
                      onChange={(e) => setRechargeAmt(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((v) => (
                      <Button
                        key={v}
                        variant="secondary"
                        size="sm"
                        onClick={() => setRechargeAmt(String(v))}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>

                  {/* What the money buys, before and after */}
                  <div
                    className={cn(
                      'rounded-lg border p-3 text-sm transition-colors',
                      rechargeUnits > 0 ? 'border-accent/50 bg-accent/10' : 'bg-muted/40'
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-muted-foreground">Units you get</span>
                      <span className="num font-bold text-accent">
                        +{kwh(rechargeUnits)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between border-t pt-1.5">
                      <span className="text-muted-foreground">Units after top-up</span>
                      <span className="num font-semibold">
                        {kwh(unitsLeft + rechargeUnits)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Charged at {TARIFF_LABEL}
                    </p>
                  </div>

                  <Button variant="accent" className="w-full" onClick={submitRecharge}>
                    Recharge
                  </Button>
                </TabsContent>

                <TabsContent value="transfer" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Transfer to</Label>
                    <Select value={transferTo} onValueChange={setTransferTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a flat" />
                      </SelectTrigger>
                      <SelectContent>
                        {others.map(({ i, name }) => (
                          <SelectItem key={i} value={String(i)}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tAmt">Amount (₦)</Label>
                    <Input
                      id="tAmt"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="e.g. 50"
                      value={transferAmt}
                      onChange={(e) => setTransferAmt(e.target.value)}
                    />
                    {Number(transferAmt) > 0 && (
                      <p className="num text-xs text-muted-foreground">
                        Sends {kwh(unitsFor(Number(transferAmt)))} of units
                      </p>
                    )}
                  </div>
                  <Button className="w-full" onClick={submitTransfer}>
                    Send transfer
                  </Button>
                </TabsContent>

                <TabsContent value="borrow" className="space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">Emergency credit</p>
                    <p className="mt-1 text-muted-foreground">
                      Borrow {naira(EMERGENCY_AMT)} ({kwh(unitsFor(EMERGENCY_AMT))}) once
                      to keep the lights on. It is auto-repaid from your next recharge
                      before any credit is added.
                    </p>
                    {f.emergencyUsed && (
                      <p className="mt-2 font-medium text-foreground">
                        Currently owing {naira(f.emergencyOwed)}.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="accent"
                    className="w-full"
                    disabled={f.emergencyUsed}
                    onClick={() => actions.borrow(flatIndex)}
                  >
                    Borrow {naira(EMERGENCY_AMT)}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
