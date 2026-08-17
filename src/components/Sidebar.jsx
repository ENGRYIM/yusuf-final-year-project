import { LayoutGrid, Gauge, Wifi, WifiOff, Zap } from 'lucide-react'
import { AP_SSID } from '@/lib/constants'
import { STATUS } from '@/hooks/useEnergySystem'
import { cn } from '@/lib/utils'

export const NAV = [
  { id: 'monitor', label: 'Building Monitor', icon: LayoutGrid },
  { id: 'tenant', label: 'Tenant Portal', icon: Gauge },
]

// How the live Realtime Database link is reported in the device panel.
const LINK = {
  [STATUS.LIVE]: { label: 'Live data', dot: 'bg-emerald-500', ok: true },
  [STATUS.CONNECTING]: { label: 'Connecting…', dot: 'bg-amber-500', ok: true },
  [STATUS.WAITING]: { label: 'No data yet', dot: 'bg-amber-500', ok: false },
  [STATUS.UNCONFIGURED]: { label: 'Not configured', dot: 'bg-muted-foreground', ok: false },
  [STATUS.ERROR]: { label: 'Link error', dot: 'bg-destructive', ok: false },
}

// Shared inner content for both the desktop sidebar and the mobile drawer.
// Building-wide figures are administrator-only — a tenant at the panel should
// not learn how many other flats are connected.
export function SidebarContent({
  view,
  setView,
  status = STATUS.CONNECTING,
  flatCount = 0,
  onlineCount = 0,
  isAdmin = false,
  onNavigate,
}) {
  const link = LINK[status] ?? LINK[STATUS.CONNECTING]
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

      {/* Device link status — reports the real Realtime Database stream */}
      <div className="space-y-3 border-t p-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {link.ok ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {AP_SSID}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', link.dot)} />
              {link.label}
            </span>
          </div>
          {isAdmin && status === STATUS.LIVE && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {onlineCount}/{flatCount} flats connected
            </p>
          )}
        </div>
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
