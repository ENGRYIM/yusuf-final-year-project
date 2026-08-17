import { useEffect, useRef, useState } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ADMIN_PIN, LOCKOUT_MS, MAX_PIN_ATTEMPTS, PIN_LENGTH } from '@/lib/constants'

// The Building Monitor shows every flat's credit, load and transactions, so it
// is landlord-only. Tenants signing into their own flat never pass through here.
export default function AdminGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [lockedUntil, setLockedUntil] = useState(0)
  const [, force] = useState(0)
  const attempts = useRef(0)

  const locked = lockedUntil > Date.now()
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))

  // Tick once a second while locked out so the countdown stays honest.
  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [locked])

  const submit = (e) => {
    e?.preventDefault()
    if (locked) return
    if (pin === ADMIN_PIN) {
      attempts.current = 0
      onUnlock()
      return
    }
    attempts.current += 1
    setPin('')
    if (attempts.current >= MAX_PIN_ATTEMPTS) {
      attempts.current = 0
      setLockedUntil(Date.now() + LOCKOUT_MS)
      setError('Too many attempts. Locked for 30s.')
    } else {
      setError('Incorrect administrator PIN')
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-7 sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-lg font-bold">Administrator access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The Building Monitor shows credit and usage for every flat. Enter the
          administrator PIN to continue.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adminPin">Administrator PIN</Label>
            <Input
              id="adminPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              placeholder="••••"
              className="num tracking-[0.5em]"
              disabled={locked}
              value={pin}
              onChange={(e) => {
                setError('')
                setPin(e.target.value.replace(/\D/g, ''))
              }}
            />
          </div>

          {locked ? (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-sm font-medium text-destructive"
            >
              <Lock className="h-4 w-4" /> Locked — wait {secondsLeft}s
            </p>
          ) : (
            error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )
          )}

          <Button
            type="submit"
            variant="accent"
            className="h-11 w-full text-base"
            disabled={locked || pin.length !== PIN_LENGTH}
          >
            Unlock monitor
          </Button>
        </form>

        <p className="mt-5 rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
          Demo administrator PIN <b className="text-foreground">{ADMIN_PIN}</b>
        </p>
      </Card>
    </div>
  )
}
