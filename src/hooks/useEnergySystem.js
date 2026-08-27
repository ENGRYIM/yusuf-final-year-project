import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ref, onValue, set } from 'firebase/database'
import { db, firebaseEnabled } from '@/lib/firebase'
import { flatsFromSnapshot } from '@/lib/flatMapper'
import { clearPins, pinKey, savePin } from '@/lib/pinStore'
import {
  TARIFF_LABEL,
  LOW_BAL_WARN,
  DEFAULT_BORROW_LIMIT,
  DEFAULT_FLAT_PIN,
  MAX_PIN_ATTEMPTS,
  LOCKOUT_MS,
  unitsFor,
  kwh,
  naira,
} from '@/lib/constants'

const clone = (flats) => flats.map((f) => ({ ...f, meter: { ...f.meter } }))

// Connection status, and the only source of truth about what the user is
// looking at. There is no simulation: every figure on screen came from the
// hardware via Realtime Database, or the screen says so plainly.
//   unconfigured — no VITE_FIREBASE_* values, so we never even connect
//   connecting   — subscribed, first snapshot not in yet
//   waiting      — connected, but the meter has not published any flats
//   live         — real flat data is streaming
//   error        — the read failed (rules, network, bad URL)
export const STATUS = {
  UNCONFIGURED: 'unconfigured',
  CONNECTING: 'connecting',
  WAITING: 'waiting',
  LIVE: 'live',
  ERROR: 'error',
}

// Central hook over the firmware's shared core logic (coreRecharge,
// coreTransfer, coreBorrow, authenticate) against live device data.
export function useEnergySystem() {
  const [flats, setFlats] = useState([])
  const [history, setHistory] = useState([])
  const [samples, setSamples] = useState([]) // time-series for charts
  const [status, setStatus] = useState(
    firebaseEnabled ? STATUS.CONNECTING : STATUS.UNCONFIGURED
  )
  const [errorMsg, setErrorMsg] = useState('')
  // Global borrow limit — lives at settings/borrowLimit in RTDB so it can be
  // changed (e.g. from the Firebase console) without redeploying the app.
  const [borrowLimit, setBorrowLimit] = useState(DEFAULT_BORROW_LIMIT)
  const statusRef = useRef(status)
  const warnedRef = useRef({})
  const idRef = useRef(1)
  const prevRelays = useRef([])
  const flatsRef = useRef(flats)
  statusRef.current = status
  flatsRef.current = flats

  const pushHistory = useCallback((flat, type, amount = 0, note = '') => {
    setHistory((prev) =>
      [
        {
          id: idRef.current++,
          ts: Date.now(),
          flat,
          type,
          amount,
          units: unitsFor(amount), // energy equivalent of the credit moved
          note,
        },
        ...prev,
      ].slice(0, 60)
    )
  }, [])

  // ── Realtime Database subscription ──
  // The single source of flats, meter readings and monthly history.
  useEffect(() => {
    if (!firebaseEnabled || !db) return
    const flatsDbRef = ref(db, 'flats')
    const unsub = onValue(
      flatsDbRef,
      (snap) => {
        const val = snap.val()
        if (val && typeof val === 'object' && Object.keys(val).length) {
          setFlats((prev) => flatsFromSnapshot(val, prev))
          setStatus(STATUS.LIVE)
        } else {
          // Connected, but nothing published yet — show the waiting state
          // rather than stale flats from a previous snapshot.
          setFlats([])
          setStatus(STATUS.WAITING)
        }
        setErrorMsg('')
      },
      (err) => {
        console.error('[firebase] flats read failed', err)
        setStatus(STATUS.ERROR)
        setErrorMsg(err?.message || 'Realtime Database read failed')
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

  // Meter fields (voltage/current/powerW/dailyEnergy/totalEnergy) are written
  // by the firmware only. The dashboard issues commands via the pending* nodes
  // below and never writes readings back, so it cannot clobber hardware state.

  // ── Sample the live meters once a second for the charts (last ~45 points) ──
  useEffect(() => {
    const id = setInterval(() => {
      const fs = flatsRef.current
      if (statusRef.current !== STATUS.LIVE || !fs.length) return
      const label = new Date().toLocaleTimeString('en-GB', {
        minute: '2-digit',
        second: '2-digit',
      })
      const sample = { t: label, load: 0 }
      fs.forEach((f, i) => {
        const w = f.relayOn ? Math.round(f.meter.powerW) : 0
        sample.load += w
        sample[`p${i}`] = w
        sample[`b${i}`] = +f.balance.toFixed(2)
        sample[`e${i}`] = +f.totalEnergy.toFixed(4) // energy consumed, kWh
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
        toast.warning(
          `${f.name}: low balance — ${naira(f.balance)} (${kwh(unitsFor(f.balance))} left)`
        )
      }
      if (!low) warnedRef.current[f.name] = false
    }
  }, [flats])

  // ── Relay connect/disconnect events (single source of truth) ──
  // Keyed by flat id so a flat appearing or being reordered in the snapshot
  // cannot be mistaken for a relay that changed state.
  useEffect(() => {
    const prev = prevRelays.current
    const prevById = new Map(prev.map((p) => [p.id, p.relayOn]))
    flats.forEach((f, i) => {
      const was = prevById.get(f.id)
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
    prevRelays.current = flats.map((f) => ({ id: f.id, relayOn: f.relayOn }))
  }, [flats, pushHistory])

  const isLocked = useCallback((i) => {
    const f = flats[i]
    return Boolean(f) && f.lockedUntil > 0 && Date.now() < f.lockedUntil
  }, [flats])

  const lockSecondsRemaining = useCallback((i) => {
    const f = flats[i]
    if (!f || !f.lockedUntil) return 0
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
        if (next[i]) {
          next[i].failedAttempts = 0
          next[i].lockedUntil = 0
        }
        return next
      })
      return { ok: true, msg: 'Authenticated' }
    }

    const attempts = f.failedAttempts + 1
    const locked = attempts >= MAX_PIN_ATTEMPTS
    setFlats((prev) => {
      const next = clone(prev)
      if (next[i]) {
        next[i].failedAttempts = attempts
        if (locked) next[i].lockedUntil = Date.now() + LOCKOUT_MS
      }
      return next
    })
    return locked
      ? { ok: false, msg: 'Too many attempts. Locked for 30s.' }
      : { ok: false, msg: 'Incorrect PIN' }
  }, [flats])

  // ── recharge ──
  // IMPORTANT: this does NOT write "balance" directly anymore. The ESP32
  // pushes its own local balance to Firebase every ~1s (see
  // syncAllFlatsToFirebase() in the firmware); if we wrote balance straight
  // from here, that periodic push would clobber it within ~1-3 seconds and
  // the recharge would appear to "revert". Instead we drop the amount into
  // flats/{id}/pendingTopup, which the firmware polls each sync cycle,
  // applies via its own coreRecharge() (so relay-on / emergency-repay logic
  // stays correct), clears, and then pushes the real, authoritative balance
  // back down through the normal flats/ listener above. So the ESP32 stays
  // the single writer of balance - the web app only ever requests a topup.
  const recharge = useCallback((i, amt) => {
    amt = Number(amt)
    if (!amt || amt <= 0) {
      toast.error('Invalid amount')
      return false
    }
    if (statusRef.current !== STATUS.LIVE || !firebaseEnabled || !db) {
      toast.error('Not connected to the meter', {
        description: 'Credit cannot be changed until live data is available.',
      })
      return false
    }
    const f = flatsRef.current[i]
    if (!f) {
      toast.error('Unknown flat')
      return false
    }
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    set(ref(db, `flats/${f.id}/pendingTopup`), { requestId, amount: amt }).catch((e) => {
      console.error('[firebase] pendingTopup write failed', e)
      toast.error('Failed to sync to Firebase')
    })
    toast.success(`Recharge of ${naira(amt)} sent to meter`, {
      description: `Applying ${kwh(unitsFor(amt))} — balance updates in a moment.`,
    })
    pushHistory(i, 'recharge', amt)
    return true
  }, [pushHistory])

  // ── transfer ──
  // The ESP32 is the single writer of balance. The web app therefore queues a
  // transfer request and lets the firmware run coreTransfer() against its
  // authoritative local balances. This prevents the next Firebase sync from
  // overwriting a browser-side balance change.
  const transfer = useCallback((from, to, amt) => {
    amt = Number(amt)
    if (from === to) {
      toast.error('Cannot transfer to self')
      return false
    }
    if (!flats[from] || !flats[to]) {
      toast.error('Unknown flat')
      return false
    }
    if (!amt || amt <= 0 || amt > flats[from].balance) {
      toast.error('Insufficient balance')
      return false
    }
    if (statusRef.current !== STATUS.LIVE || !firebaseEnabled || !db) {
      toast.error('Not connected to the meter', {
        description: 'Credit cannot be changed until live data is available.',
      })
      return false
    }

    const fromId = flats[from].id
    const toId = flats[to].id
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    set(ref(db, `flats/${fromId}/pendingTransfer`), {
      requestId,
      toFlatId: toId,
      amount: amt,
    }).catch((e) => {
      console.error('[firebase] pendingTransfer write failed', e)
      toast.error('Failed to sync transfer to Firebase')
    })

    toast.success(`Transfer of ${naira(amt)} (${kwh(unitsFor(amt))}) sent to meter`, {
      description: `${flats[from].name} → ${flats[to].name}; balances update in a moment.`,
    })
    pushHistory(from, 'transfer_out', amt, flats[to].name)
    pushHistory(to, 'transfer_in', amt, flats[from].name)
    return true
  }, [flats, pushHistory])

  // ── borrow ──
  // Like recharge and transfer, borrowing is a firmware-side transaction.
  // The browser only queues the requested amount; the ESP32 applies it through
  // coreBorrow() so balance/emergency state cannot be clobbered by its next sync.
  const borrow = useCallback((i, amt = borrowLimit) => {
    if (!flats[i]) return false
    if (flats[i].emergencyUsed) {
      toast.error(
        `Emergency credit already in use. Repay ${naira(flats[i].emergencyOwed)} first.`
      )
      return false
    }
    amt = Number(amt)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount')
      return false
    }
    if (amt > borrowLimit) {
      toast.error(`You can borrow up to ${naira(borrowLimit)}`)
      return false
    }
    if (statusRef.current !== STATUS.LIVE || !firebaseEnabled || !db) {
      toast.error('Not connected to the meter', {
        description: 'Credit cannot be changed until live data is available.',
      })
      return false
    }

    const flatId = flats[i].id
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    set(ref(db, `flats/${flatId}/pendingBorrow`), { requestId, amount: amt }).catch((e) => {
      console.error('[firebase] pendingBorrow write failed', e)
      toast.error('Failed to sync borrow to Firebase')
    })

    toast.success(`Emergency credit of ${naira(amt)} (${kwh(unitsFor(amt))}) sent to meter`, {
      description: 'The meter will apply the credit and update the balance in a moment.',
    })
    pushHistory(i, 'borrow', amt)
    return true
  }, [flats, borrowLimit, pushHistory])

  // ── Change PIN (verifies current PIN, mirrors the firmware's hashed store) ──
  // The new PIN is persisted so it still works after a reload — a PIN that
  // reverts to the default on refresh has not really been changed.
  const changePin = useCallback((i, current, next) => {
    const f = flats[i]
    if (!f) return { ok: false, msg: 'Unknown flat' }
    if (current !== f.pin) return { ok: false, msg: 'Current PIN is incorrect' }
    if (!/^\d{4}$/.test(next)) return { ok: false, msg: 'New PIN must be 4 digits' }
    if (next === current) return { ok: false, msg: 'New PIN must be different' }
    setFlats((prev) => {
      const n = clone(prev)
      if (n[i]) n[i].pin = next
      return n
    })
    const saved = savePin(pinKey(f, i), next)
    toast.success(`${f.name}: PIN updated`, {
      description: saved
        ? 'Saved on this device — use it next time you sign in.'
        : 'This browser blocks storage, so it will reset when you reload.',
    })
    pushHistory(i, 'pin_change')
    return { ok: true, msg: 'PIN updated' }
  }, [flats, pushHistory])

  // ── Reset tenant PINs (administrator) ──
  // The way back in when a tenant forgets the PIN they set: nothing can read a
  // chosen PIN back, so restoring the factory default is the recovery path.
  // Meter data is untouched — it belongs to the hardware.
  const resetPins = useCallback(() => {
    clearPins()
    setFlats((prev) => {
      const next = clone(prev)
      next.forEach((f) => {
        f.pin = DEFAULT_FLAT_PIN
        f.failedAttempts = 0
        f.lockedUntil = 0
      })
      return next
    })
    toast.success('Tenant PINs reset', {
      description: `Every flat is back to the default PIN (${DEFAULT_FLAT_PIN}).`,
    })
  }, [])

  return {
    flats,
    history,
    samples,
    status,
    errorMsg,
    borrowLimit,
    isLocked,
    lockSecondsRemaining,
    authenticate,
    recharge,
    transfer,
    borrow,
    changePin,
    resetPins,
  }
}
