import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ref, onValue, update, set } from 'firebase/database'
import { db, firebaseEnabled } from '@/lib/firebase'
import { flatsFromSnapshot, toRtdbWrite } from '@/lib/flatMapper'
import {
  INITIAL_FLATS,
  TARIFF_RATE,
  LOW_BAL_WARN,
  DEFAULT_BORROW_LIMIT,
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
  // Where the flat data is coming from: 'live' once Realtime Database has
  // streamed us data, otherwise 'sim' (the local billing simulation fallback).
  const [source, setSource] = useState('sim')
  // Demo billing speed: 1 real second is billed as this many simulated
  // minutes so balances visibly drain during a demo. 0 = paused.
  const [speed, setSpeed] = useState(60)
  // Global borrow limit — lives at settings/borrowLimit in RTDB so it can be
  // changed (e.g. from the Firebase console) without redeploying the app.
  const [borrowLimit, setBorrowLimit] = useState(DEFAULT_BORROW_LIMIT)
  const speedRef = useRef(speed)
  const sourceRef = useRef(source)
  const warnedRef = useRef({})
  const idRef = useRef(1)
  const prevRelays = useRef(INITIAL_FLATS.map((f) => f.relayOn))
  const flatsRef = useRef(flats)
  speedRef.current = speed
  sourceRef.current = source
  flatsRef.current = flats

  const pushHistory = useCallback((flat, type, amount = 0, note = '') => {
    setHistory((prev) =>
      [{ id: idRef.current++, ts: Date.now(), flat, type, amount, note }, ...prev].slice(0, 60)
    )
  }, [])

  // ── Realtime Database subscription ──
  // When live data is present it becomes the source of truth; the local
  // simulation below stands down. If Firebase is unconfigured, empty, or errors,
  // we stay on the simulation so the demo still works offline.
  useEffect(() => {
    if (!firebaseEnabled || !db) return
    const flatsDbRef = ref(db, 'flats')
    const unsub = onValue(
      flatsDbRef,
      (snap) => {
        const val = snap.val()
        if (val && typeof val === 'object' && Object.keys(val).length) {
          setFlats((prev) => flatsFromSnapshot(val, prev))
          setSource('live')
          sourceRef.current = 'live'
        } else {
          setSource('sim')
          sourceRef.current = 'sim'
        }
      },
      (err) => {
        console.error('[firebase] flats read failed', err)
        setSource('sim')
        sourceRef.current = 'sim'
        toast.error('Firebase read failed — using local simulation')
      }
    )
    return () => unsub()
  }, [])

  // ── Global borrow limit subscription ──
  // Reads settings/borrowLimit so the limit can be changed remotely (e.g. from
  // the Firebase console) without a redeploy. Seeds it with the default the
  // first time so the node exists and is easy to find/edit later.
  useEffect(() => {
    if (!firebaseEnabled || !db) return
    const limitRef = ref(db, 'settings/borrowLimit')
    const unsub = onValue(
      limitRef,
      (snap) => {
        const val = snap.val()
        if (typeof val === 'number' && val > 0) {
          setBorrowLimit(val)
        } else {
          setBorrowLimit(DEFAULT_BORROW_LIMIT)
          set(limitRef, DEFAULT_BORROW_LIMIT).catch((e) =>
            console.error('[firebase] failed to seed borrow limit', e)
          )
        }
      },
      (err) => {
        console.error('[firebase] borrow limit read failed', err)
        setBorrowLimit(DEFAULT_BORROW_LIMIT)
      }
    )
    return () => unsub()
  }, [])

  // Apply a mutation either to Realtime Database (when live) or to local state
  // (simulation). `mutate(next)` mutates a cloned flats array in place and
  // returns the ids of the flats it touched so we know what to push to RTDB.
  const commit = useCallback((mutate) => {
    const live = sourceRef.current === 'live' && firebaseEnabled && db
    if (live) {
      const next = clone(flatsRef.current)
      const ids = mutate(next) || []
      setFlats(next) // optimistic; the onValue listener reconciles
      const updates = {}
      for (const id of ids) {
        const f = next.find((x) => x.id === id)
        if (!f) continue
        const w = toRtdbWrite(f)
        for (const k in w) updates[`${id}/${k}`] = w[k]
      }
      update(ref(db, 'flats'), updates).catch((e) => {
        console.error('[firebase] write failed', e)
        toast.error('Failed to sync to Firebase')
      })
    } else {
      setFlats((prev) => {
        const next = clone(prev)
        mutate(next)
        return next
      })
    }
  }, [])

  // ── Billing tick (runs every second) ──
  useEffect(() => {
    const id = setInterval(() => {
      // Live data from the hardware owns the meters and balances — don't
      // simulate on top of it. Only run the sim as the offline fallback.
      if (sourceRef.current === 'live') return
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
      if (was !== undefined && was !== f.relayOn) {
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
    commit((next) => {
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
      return [f.id]
    })
    toast.success(`Recharged ${amt.toFixed(2)} NGN`)
    pushHistory(i, 'recharge', amt)
    return true
  }, [commit, pushHistory])

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
    commit((next) => {
      next[from].balance -= amt
      next[to].balance += amt
      if (!next[to].relayOn && next[to].balance > 0) next[to].relayOn = true
      return [next[from].id, next[to].id]
    })
    toast.success(`Transferred ${amt.toFixed(2)} NGN to ${flats[to].name}`)
    pushHistory(from, 'transfer_out', amt, flats[to].name)
    pushHistory(to, 'transfer_in', amt, flats[from].name)
    return true
  }, [flats, commit, pushHistory])

  // ── coreBorrow ──
  // amt is tenant-chosen, capped at the live global borrowLimit synced from
  // Firebase (settings/borrowLimit). Falls back to DEFAULT_BORROW_LIMIT when
  // no amount is passed, so existing callers keep working.
  const borrow = useCallback((i, amt = borrowLimit) => {
    if (flats[i].emergencyUsed) {
      toast.error(
        `Emergency credit already in use. Repay ${flats[i].emergencyOwed.toFixed(2)} NGN first.`
      )
      return false
    }
    amt = Number(amt)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount')
      return false
    }
    if (amt > borrowLimit) {
      toast.error(`You can borrow up to ${borrowLimit.toFixed(2)} NGN`)
      return false
    }
    commit((next) => {
      const f = next[i]
      f.balance += amt
      f.emergencyOwed = amt
      f.emergencyUsed = true
      if (!f.relayOn) f.relayOn = true
      return [f.id]
    })
    toast.success(`Emergency credit of ${amt.toFixed(2)} NGN granted`)
    pushHistory(i, 'borrow', amt)
    return true
  }, [flats, borrowLimit, commit, pushHistory])

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
    source,
    speed,
    setSpeed,
    borrowLimit,
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
