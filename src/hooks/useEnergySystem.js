import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  INITIAL_FLATS,
  TARIFF_RATE,
  LOW_BAL_WARN,
  EMERGENCY_AMT,
  MAX_PIN_ATTEMPTS,
  LOCKOUT_MS,
} from '@/lib/constants'

const clone = (flats) => flats.map((f) => ({ ...f, meter: { ...f.meter } }))

// Central hook replicating the firmware's shared core logic (coreRecharge,
// coreTransfer, coreBorrow, billingTick, authenticate) against dummy data.
export function useEnergySystem() {
  const [flats, setFlats] = useState(() => clone(INITIAL_FLATS))
  const [history, setHistory] = useState([])
  const [samples, setSamples] = useState([]) // time-series for charts
  // Demo billing speed: 1 real second is billed as this many simulated
  // minutes so balances visibly drain during a demo. 0 = paused.
  const [speed, setSpeed] = useState(60)
  const speedRef = useRef(speed)
  const warnedRef = useRef({})
  const idRef = useRef(1)
  const prevRelays = useRef(INITIAL_FLATS.map((f) => f.relayOn))
  const flatsRef = useRef(flats)
  speedRef.current = speed
  flatsRef.current = flats

  const pushHistory = useCallback((flat, type, amount = 0, note = '') => {
    setHistory((prev) =>
      [{ id: idRef.current++, ts: Date.now(), flat, type, amount, note }, ...prev].slice(0, 60)
    )
  }, [])

  // ── Billing tick (runs every second) ──
  useEffect(() => {
    const id = setInterval(() => {
      const simMinutes = speedRef.current
      if (simMinutes <= 0) return
      const elapsedHours = simMinutes / 60

      setFlats((prev) => {
        const next = clone(prev)
        for (const f of next) {
          // Small live jitter on the meter so the "live power" reads real.
          const base = f.meter.powerW
          const jittered = Math.max(0, base + (Math.round(base * 0.04) - Math.round(base * 0.08 * Math.abs(Math.sin(Date.now() / 900 + base)))))
          f.meter.current = +(jittered / f.meter.voltage).toFixed(2)

          if (!f.relayOn) continue

          const kWhThisTick = (jittered / 1000) * elapsedHours
          f.dailyEnergy += kWhThisTick
          f.balance -= kWhThisTick * TARIFF_RATE

          // Auto-repay emergency debt as balance recovers.
          if (f.emergencyOwed > 0 && f.balance > 0) {
            const repay = Math.min(f.balance, f.emergencyOwed)
            f.balance -= repay
            f.emergencyOwed -= repay
            if (f.emergencyOwed <= 0.01) {
              f.emergencyOwed = 0
              f.emergencyUsed = false
            }
          }

          // Cut power when broke and no emergency credit in play.
          // (Toast + history are handled by the relay-transition effect.)
          if (f.balance <= 0 && !f.emergencyUsed) {
            f.balance = 0
            if (f.relayOn) f.relayOn = false
          }
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Sample the meters once a second for the charts (last ~45 points) ──
  useEffect(() => {
    const id = setInterval(() => {
      const fs = flatsRef.current
      const d = new Date()
      const label = d.toLocaleTimeString('en-GB', {
        minute: '2-digit',
        second: '2-digit',
      })
      const sample = { t: label, load: 0 }
      fs.forEach((f, i) => {
        const w = f.relayOn ? Math.round(f.meter.powerW) : 0
        sample.load += w
        sample[`p${i}`] = w
        sample[`b${i}`] = +f.balance.toFixed(2)
      })
      setSamples((prev) => [...prev, sample].slice(-45))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Low-balance warnings ──
  useEffect(() => {
    for (const f of flats) {
      const low = f.balance > 0 && f.balance <= LOW_BAL_WARN
      if (low && !warnedRef.current[f.name]) {
        warnedRef.current[f.name] = true
        toast.warning(`${f.name}: low balance (${f.balance.toFixed(2)} NGN)`)
      }
      if (!low) warnedRef.current[f.name] = false
    }
  }, [flats])

  // ── Relay connect/disconnect events (single source of truth) ──
  useEffect(() => {
    flats.forEach((f, i) => {
      const was = prevRelays.current[i]
      if (was !== f.relayOn) {
        if (f.relayOn) {
          toast.success(`${f.name}: power restored`)
          pushHistory(i, 'power_on')
        } else {
          toast.error(`${f.name}: power disconnected (no credit)`)
          pushHistory(i, 'power_off')
        }
      }
    })
    prevRelays.current = flats.map((f) => f.relayOn)
  }, [flats, pushHistory])

  const isLocked = useCallback((i) => {
    const f = flats[i]
    return f.lockedUntil > 0 && Date.now() < f.lockedUntil
  }, [flats])

  const lockSecondsRemaining = useCallback((i) => {
    const f = flats[i]
    if (!f.lockedUntil) return 0
    return Math.max(0, Math.ceil((f.lockedUntil - Date.now()) / 1000))
  }, [flats])

  // ── authenticate() — shared lockout logic ──
  // The verdict is computed from current state (not inside the setState
  // updater, which runs later) so the caller gets a correct synchronous result.
  const authenticate = useCallback((i, pin) => {
    if (i < 0 || i >= flats.length) return { ok: false, msg: 'Invalid flat' }
    const f = flats[i]
    if (f.lockedUntil > 0 && Date.now() < f.lockedUntil) {
      const s = Math.ceil((f.lockedUntil - Date.now()) / 1000)
      return { ok: false, msg: `Locked. Try again in ${s}s` }
    }

    if (pin === f.pin) {
      setFlats((prev) => {
        const next = clone(prev)
        next[i].failedAttempts = 0
        next[i].lockedUntil = 0
        return next
      })
      return { ok: true, msg: 'Authenticated' }
    }

    const attempts = f.failedAttempts + 1
    const locked = attempts >= MAX_PIN_ATTEMPTS
    setFlats((prev) => {
      const next = clone(prev)
      next[i].failedAttempts = attempts
      if (locked) next[i].lockedUntil = Date.now() + LOCKOUT_MS
      return next
    })
    return locked
      ? { ok: false, msg: 'Too many attempts. Locked for 30s.' }
      : { ok: false, msg: 'Incorrect PIN' }
  }, [flats])

  // ── coreRecharge ──
  const recharge = useCallback((i, amt) => {
    amt = Number(amt)
    if (!amt || amt <= 0) {
      toast.error('Invalid amount')
      return false
    }
    setFlats((prev) => {
      const next = clone(prev)
      const f = next[i]
      f.balance += amt
      if (f.emergencyOwed > 0) {
        const repay = Math.min(amt, f.emergencyOwed)
        f.balance -= repay
        f.emergencyOwed -= repay
        if (f.emergencyOwed <= 0.01) {
          f.emergencyOwed = 0
          f.emergencyUsed = false
        }
      }
      if (!f.relayOn && f.balance > 0) f.relayOn = true
      return next
    })
    toast.success(`Recharged ${amt.toFixed(2)} NGN`)
    pushHistory(i, 'recharge', amt)
    return true
  }, [pushHistory])

  // ── coreTransfer ──
  const transfer = useCallback((from, to, amt) => {
    amt = Number(amt)
    if (from === to) {
      toast.error('Cannot transfer to self')
      return false
    }
    if (!amt || amt <= 0 || amt > flats[from].balance) {
      toast.error('Insufficient balance')
      return false
    }
    setFlats((prev) => {
      const next = clone(prev)
      next[from].balance -= amt
      next[to].balance += amt
      if (!next[to].relayOn && next[to].balance > 0) next[to].relayOn = true
      return next
    })
    toast.success(`Transferred ${amt.toFixed(2)} NGN to ${flats[to].name}`)
    pushHistory(from, 'transfer_out', amt, flats[to].name)
    pushHistory(to, 'transfer_in', amt, flats[from].name)
    return true
  }, [flats, pushHistory])

  // ── coreBorrow ──
  const borrow = useCallback((i) => {
    if (flats[i].emergencyUsed) {
      toast.error(
        `Emergency credit already in use. Repay ${flats[i].emergencyOwed.toFixed(2)} NGN first.`
      )
      return false
    }
    setFlats((prev) => {
      const next = clone(prev)
      const f = next[i]
      f.balance += EMERGENCY_AMT
      f.emergencyOwed = EMERGENCY_AMT
      f.emergencyUsed = true
      if (!f.relayOn) f.relayOn = true
      return next
    })
    toast.success(`Emergency credit of ${EMERGENCY_AMT.toFixed(2)} NGN granted`)
    pushHistory(i, 'borrow', EMERGENCY_AMT)
    return true
  }, [flats, pushHistory])

  // ── Change PIN (verifies current PIN, mirrors the firmware's hashed store) ──
  const changePin = useCallback((i, current, next) => {
    const f = flats[i]
    if (current !== f.pin) return { ok: false, msg: 'Current PIN is incorrect' }
    if (!/^\d{4}$/.test(next)) return { ok: false, msg: 'New PIN must be 4 digits' }
    if (next === current) return { ok: false, msg: 'New PIN must be different' }
    setFlats((prev) => {
      const n = clone(prev)
      n[i].pin = next
      return n
    })
    toast.success(`${f.name}: PIN updated`)
    pushHistory(i, 'pin_change')
    return { ok: true, msg: 'PIN updated' }
  }, [flats, pushHistory])

  // ── Reset demo back to the initial state ──
  const reset = useCallback(() => {
    setFlats(clone(INITIAL_FLATS))
    setHistory([])
    setSamples([])
    warnedRef.current = {}
    prevRelays.current = INITIAL_FLATS.map((f) => f.relayOn)
    toast.success('Demo data reset')
  }, [])

  return {
    flats,
    history,
    samples,
    speed,
    setSpeed,
    isLocked,
    lockSecondsRemaining,
    authenticate,
    recharge,
    transfer,
    borrow,
    changePin,
    reset,
  }
}
