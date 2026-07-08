import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { useEnergySystem } from '@/hooks/useEnergySystem'
import { useTheme } from '@/hooks/useTheme'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import ThemeToggle from '@/components/ThemeToggle'
import LoginScreen from '@/components/LoginScreen'
import Dashboard from '@/components/Dashboard'
import BuildingOverview from '@/components/BuildingOverview'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function App() {
  const sys = useEnergySystem()
  const { dark, toggle } = useTheme()
  const [view, setView] = useState('monitor') // 'monitor' | 'tenant'
  const [flatIndex, setFlatIndex] = useState(null)
  const now = useClock()

  const actions = {
    recharge: sys.recharge,
    transfer: sys.transfer,
    borrow: sys.borrow,
    changePin: sys.changePin,
  }
  const pageTitle = view === 'monitor' ? 'Building Monitor' : 'Tenant Portal'
  // Re-key the content on navigation so it re-plays the entrance animation.
  const contentKey = view === 'tenant' ? `tenant-${flatIndex}` : view

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        view={view}
        setView={setView}
        speed={sys.speed}
        setSpeed={sys.setSpeed}
        flats={sys.flats}
        reset={sys.reset}
      />

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <MobileNav
              view={view}
              setView={setView}
              speed={sys.speed}
              setSpeed={sys.setSpeed}
              flats={sys.flats}
              reset={sys.reset}
            />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold">{pageTitle}</span>
            </div>
          </div>
          <ThemeToggle dark={dark} toggle={toggle} className="h-9 w-9" />
        </header>

        {/* Desktop page header */}
        <header className="hidden items-center justify-between border-b bg-card/40 px-8 py-4 lg:flex">
          <div>
            <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground">
              {view === 'monitor'
                ? 'Live consumption across all flats'
                : 'Recharge, transfer and manage flat credit'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="num text-sm font-semibold">{now.toLocaleTimeString('en-GB')}</p>
              <p className="text-xs text-muted-foreground">
                {now.toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <ThemeToggle dark={dark} toggle={toggle} />
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          <div
            key={contentKey}
            className="duration-300 animate-in fade-in-50 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {view === 'monitor' ? (
              <BuildingOverview flats={sys.flats} history={sys.history} samples={sys.samples} />
            ) : flatIndex === null ? (
              <LoginScreen
                flats={sys.flats}
                isLocked={sys.isLocked}
                lockSecondsRemaining={sys.lockSecondsRemaining}
                authenticate={sys.authenticate}
                onSuccess={setFlatIndex}
              />
            ) : (
              <Dashboard
                flats={sys.flats}
                flatIndex={flatIndex}
                history={sys.history}
                samples={sys.samples}
                actions={actions}
                onLogout={() => setFlatIndex(null)}
              />
            )}
          </div>

          <footer className="mt-10 border-t pt-5 text-center text-xs text-muted-foreground">
            Yusuf Ibn Musa · 2021/1/81460EE · FUT Minna, EEE Dept. · web dashboard (dummy data)
          </footer>
        </main>
      </div>
    </div>
  )
}
