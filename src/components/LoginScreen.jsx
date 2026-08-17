import { useEffect, useState } from 'react'
import { ArrowLeft, Delete, Lock, ShieldCheck, Wallet, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PIN_LENGTH } from '@/lib/constants'
import { cn } from '@/lib/utils'

const FEATURES = [
  { icon: ShieldCheck, title: 'PIN-secured', text: 'SHA-256 hashed, 3-try lockout' },
  { icon: Wallet, title: 'Prepaid units', text: 'Recharge, transfer & borrow' },
  { icon: Zap, title: 'Private metering', text: 'Your usage is yours alone' },
]

// `directory` is a names-only list ({ i, name }). The login screen deliberately
// never receives balances, meter readings or PINs — a tenant picking their flat
// must not be able to read anything about the others.
export default function LoginScreen({ directory, isLocked, lockSecondsRemaining, authenticate, onSuccess }) {
  const [selectedFlat, setSelectedFlat] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const locked = selectedFlat !== null && isLocked(selectedFlat)

  const pickFlat = (i) => {
    setSelectedFlat(i)
    setPin('')
    setError('')
  }
  const press = (d) => {
    if (locked || pin.length >= PIN_LENGTH) return
    setError('')
    setPin((p) => p + d)
  }
  const submit = () => {
    const res = authenticate(selectedFlat, pin)
    if (res.ok) onSuccess(selectedFlat)
    else {
      setError(res.msg)
      setPin('')
    }
  }

  // Physical-keyboard support: type digits, Backspace, Enter, Esc.
  useEffect(() => {
    if (selectedFlat === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') return setSelectedFlat(null)
      if (locked) return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        press(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPin((p) => p.slice(0, -1))
      } else if (e.key === 'Enter' && pin.length === PIN_LENGTH) {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlat, pin, locked])

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="grid w-full max-w-4xl overflow-hidden md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-primary p-8 text-primary-foreground md:flex">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Zap className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold leading-snug">
              Smart Prepaid<br />Energy System
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/70">
              Secure per-flat prepaid electricity with credit transfer.
            </p>
          </div>
          <div className="relative mt-8 space-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-primary-foreground/60">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auth panel */}
        <div className="p-6 sm:p-8">
          {selectedFlat === null ? (
            <div>
              <h3 className="text-lg font-bold">Select your flat</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a flat to sign in to its portal.
              </p>
              <div className="mt-5 grid gap-3">
                {directory.map(({ i, name }) => (
                  <button
                    key={name}
                    onClick={() => pickFlat(i)}
                    className="group flex items-center justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-accent hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-bold text-muted-foreground group-hover:bg-accent/15 group-hover:text-accent">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          PIN required
                        </p>
                      </div>
                    </div>
                    <Lock className="h-4 w-4 text-muted-foreground/60" />
                  </button>
                ))}
              </div>
              <p className="mt-5 rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
                Each flat's credit, usage and history are private to that flat.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <button
                onClick={() => setSelectedFlat(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> All flats
              </button>

              <div className="mt-4">
                <h3 className="text-lg font-bold">
                  {directory.find((d) => d.i === selectedFlat)?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Type your 4-digit PIN or tap below
                </p>
              </div>

              {/* PIN dots */}
              <div className="mt-6 flex justify-center gap-3.5" aria-hidden="true">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5 rounded-full border-2 transition-colors',
                      i < pin.length ? 'border-accent bg-accent' : 'border-muted-foreground/40'
                    )}
                  />
                ))}
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {pin.length} of {PIN_LENGTH} digits entered
              </span>

              {locked ? (
                <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-2 text-destructive">
                  <Lock className="h-8 w-8" />
                  <p className="text-sm font-medium">
                    Locked — wait {lockSecondsRemaining(selectedFlat)}s
                  </p>
                </div>
              ) : (
                <div className="mx-auto mt-6 grid w-full max-w-[260px] grid-cols-3 gap-2.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <Button
                      key={d}
                      variant="secondary"
                      className="h-14 text-lg font-semibold"
                      aria-label={`Digit ${d}`}
                      onClick={() => press(String(d))}
                    >
                      {d}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    className="h-14 text-xs"
                    aria-label="Clear PIN"
                    onClick={() => setPin('')}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-14 text-lg font-semibold"
                    aria-label="Digit 0"
                    onClick={() => press('0')}
                  >
                    0
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-14"
                    aria-label="Delete last digit"
                    onClick={() => setPin((p) => p.slice(0, -1))}
                  >
                    <Delete className="h-5 w-5" />
                  </Button>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-4 text-center text-sm font-medium text-destructive"
                >
                  {error}
                </p>
              )}

              <Button
                variant="accent"
                className="mt-6 h-11 w-full text-base"
                disabled={locked || pin.length !== PIN_LENGTH}
                onClick={submit}
              >
                Sign in
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
