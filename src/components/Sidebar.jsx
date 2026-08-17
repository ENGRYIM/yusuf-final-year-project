import { LayoutGrid, Gauge, RotateCcw, Wifi, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AP_SSID } from '@/lib/constants'
import { cn } from '@/lib/utils'

export const NAV = [
  { id: 'monitor', label: 'Building Monitor', icon: LayoutGrid },
  { id: 'tenant', label: 'Tenant Portal', icon: Gauge },
]

const SPEEDS = [
  { v: 0, label: 'Pause' },
  { v: 1, label: '1×' },
  { v: 60, label: '60×' },
  { v: 300, label: '300×' },
]

export function SpeedControl({ speed, setSpeed, className }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Billing speed
      </p>
      <div className="flex rounded-lg border bg-muted/50 p-0.5" role="group" aria-label="Billing speed">
        {SPEEDS.map((s) => (
          <button
            key={s.v}
            onClick={() => setSpeed(s.v)}
            aria-pressed={speed === s.v}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              speed === s.v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Shared inner content for both the desktop sidebar and the mobile drawer.
// Building-wide figures and the demo controls are administrator-only — a tenant
// at the panel should not learn how many other flats are connected, nor be able
// to reset the building's data.
export function SidebarContent({
  view,
  setView,
  speed,
  setSpeed,
  flatCount = 0,
  onlineCount = 0,
  reset,
  isAdmin = false,
  onNavigate,
}) {
  const go = (id) => {
    setView(id)
    onNavigate?.()
  }
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
          <Zap className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Smart Energy</p>
          <p className="text-[11px] text-muted-foreground">Prepaid metering</p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Device status + controls */}
      <div className="space-y-3 border-t p-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              {AP_SSID}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AP online
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {isAdmin ? `${onlineCount}/${flatCount} flats connected` : 'Connected'}
          </p>
        </div>
        {isAdmin && (
          <>
            <SpeedControl speed={speed} setSpeed={setSpeed} />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={reset}
            >
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Sidebar(props) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:block">
      <SidebarContent {...props} />
    </aside>
  )
}
