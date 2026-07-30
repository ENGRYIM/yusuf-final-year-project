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
import { LOW_BAL_WARN, TARIFF_RATE, naira } from '@/lib/constants'
import { cn } from '@/lib/utils'

export default function Dashboard({ flats, flatIndex, history, samples, actions, borrowLimit, onLogout }) {
  const flatHistory = history.filter((e) => e.flat === flatIndex)
  const f = flats[flatIndex]
  const [rechargeAmt, setRechargeAmt] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmt, setTransferAmt] = useState('')
  const [borrowAmt, setBorrowAmt] = useState('')

  const low = f.balance > 0 && f.balance <= LOW_BAL_WARN
  const balancePct = Math.min(100, (f.balance / 500) * 100)
  const runtime =
    f.relayOn && f.meter.powerW > 0
      ? f.balance / TARIFF_RATE / (f.meter.powerW / 1000)
      : null

  const others = flats
    .map((flat, i) => ({ flat, i }))
    .filter(({ i }) => i !== flatIndex)

  const submitRecharge = () => {
    if (actions.recharge(flatIndex, rechargeAmt)) setRechargeAmt('')
  }
  const submitTransfer = () => {
    if (transferTo === '') return
    if (actions.transfer(flatIndex, Number(transferTo), transferAmt)) setTransferAmt('')
  }
  const submitBorrow = () => {
    if (actions.borrow(flatIndex, borrowAmt)) setBorrowAmt('')
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
              <Progress
                value={balancePct}
                className="mt-5 bg-white/15"
                indicatorClassName={low ? 'bg-destructive' : 'bg-accent'}
              />
              <p className="mt-2 text-xs text-primary-foreground/60">
                Tariff {naira(TARIFF_RATE)} / kWh · warns below {naira(LOW_BAL_WARN)}
              </p>
            </div>
          </Card>

          {/* Live stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={Gauge}
              tone="accent"
              label="Live power"
              value={Math.round(f.meter.powerW)}
              unit="W"
              sub={`${f.meter.voltage} V · ${f.meter.current} A`}
            />
            <StatCard
              icon={Activity}
              label="Usage today"
              value={f.dailyEnergy.toFixed(3)}
              unit="kWh"
              sub="resets at midnight"
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

          {/* Balance trend */}
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-base">Balance trend</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart
                data={samples}
                series={[{ key: `b${flatIndex}`, label: 'Balance', color: '#f59e0b' }]}
                formatter={(v) => naira(v, 0)}
                height={180}
              />
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ActivityFeed
                entries={flatHistory}
                flats={flats}
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
                        {others.map(({ flat, i }) => (
                          <SelectItem key={i} value={String(i)}>
                            {flat.name}
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
                  </div>
                  <Button className="w-full" onClick={submitTransfer}>
                    Send transfer
                  </Button>
                </TabsContent>

                <TabsContent value="borrow" className="space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="font-medium">Emergency credit</p>
                    <p className="mt-1 text-muted-foreground">
                      Borrow up to {naira(borrowLimit)} to keep the lights on. It is
                      auto-repaid from your next recharge before any credit is added.
                    </p>
                    {f.emergencyUsed && (
                      <p className="mt-2 font-medium text-foreground">
                        Currently owing {naira(f.emergencyOwed)}.
                      </p>
                    )}
                  </div>
                  {!f.emergencyUsed && (
                    <div className="space-y-1.5">
                      <Label htmlFor="borrowAmt">Amount (₦)</Label>
                      <Input
                        id="borrowAmt"
                        type="number"
                        min="0"
                        max={borrowLimit}
                        inputMode="numeric"
                        placeholder={`Up to ${borrowLimit.toFixed(2)}`}
                        value={borrowAmt}
                        onChange={(e) => setBorrowAmt(e.target.value)}
                      />
                    </div>
                  )}
                  <Button
                    variant="accent"
                    className="w-full"
                    disabled={f.emergencyUsed}
                    onClick={submitBorrow}
                  >
                    Borrow
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
