// Translates the Realtime Database flat record into the shape the UI expects.
// RTDB stores meter fields flat (voltage/current/powerW); the app groups them
// under `meter`. PIN/lockout state has no RTDB counterpart (it's device-side
// auth), so it's kept client-side and merged back in here.
//
// Everything the dashboard displays originates here — there is no local
// simulation. If a field is missing the app shows nothing for it rather than
// inventing a value.
import { DEFAULT_FLAT_PIN, costOf, monthLabel } from '@/lib/constants'
import { loadPins } from '@/lib/pinStore'

// Client-only auth defaults. A PIN the tenant set themselves wins over the
// factory default — otherwise a reload would hand their flat back to '0000'.
const authDefaults = (id) => ({
  pin: loadPins()[id] ?? DEFAULT_FLAT_PIN,
  failedAttempts: 0,
  lockedUntil: 0,
})

// flats/<id>/monthly/<YYYY-MM> → newest-first rows for the history table.
// `billed` falls back to the tariff cost of the energy when the device does not
// publish it; `recharged` is left null (absent) rather than guessed at.
export function monthlyFromRtdb(monthly) {
  if (!monthly || typeof monthly !== 'object') return []
  return Object.keys(monthly)
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => {
      const r = monthly[key] || {}
      const energyKWh = Number(r.energyKWh ?? r.energy ?? 0) || 0
      const billed = r.billed == null ? costOf(energyKWh) : Number(r.billed) || 0
      const recharged = r.recharged == null ? null : Number(r.recharged) || 0
      return { key, label: monthLabel(key), energyKWh, billed, recharged }
    })
}

// RTDB record → app flat. `prevAuth` carries forward client-side auth state so a
// live update from the hardware doesn't wipe a flat's failed attempts / lockout.
export function fromRtdb(id, r, index, prevAuth) {
  const auth = prevAuth ?? authDefaults(id)
  const dailyEnergy = Number(r.dailyEnergy) || 0
  // An open relay must read no load regardless of what the last sample said, so
  // the UI never shows power flowing to a cut-off flat.
  const relayOn = Boolean(r.relayOn)
  return {
    id, // RTDB key, e.g. 'flat1' — needed to address writes
    name: r.name ?? `Flat ${index + 1}`,
    balance: Number(r.balance) || 0,
    dailyEnergy,
    // Older records only carry the daily figure; fall back to it so the
    // lifetime consumption readout is never blank.
    totalEnergy: Number(r.totalEnergy) || dailyEnergy,
    relayOn,
    emergencyUsed: Boolean(r.emergencyUsed),
    emergencyOwed: Number(r.emergencyOwed) || 0,
    lastUpdated: r.lastUpdated ?? null,
    monthly: monthlyFromRtdb(r.monthly),
    meter: {
      voltage: Number(r.voltage) || 0,
      current: relayOn ? Number(r.current) || 0 : 0,
      powerW: relayOn ? Number(r.powerW) || 0 : 0,
    },
    pin: auth.pin,
    failedAttempts: auth.failedAttempts,
    lockedUntil: auth.lockedUntil,
  }
}

// Sort RTDB keys deterministically (flat1, flat2, … / flat10 after flat9) so the
// array order the UI renders is stable across updates.
export function sortedFlatKeys(flatsObj) {
  return Object.keys(flatsObj).sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10)
    const nb = parseInt(String(b).replace(/\D/g, ''), 10)
    if (Number.isNaN(na) || Number.isNaN(nb)) return a < b ? -1 : 1
    return na - nb
  })
}

// Whole snapshot → ordered app flats array. Preserves client auth via prevFlats.
export function flatsFromSnapshot(flatsObj, prevFlats = []) {
  const prevById = new Map(prevFlats.map((f) => [f.id, f]))
  return sortedFlatKeys(flatsObj).map((id, i) => {
    const prev = prevById.get(id)
    const prevAuth = prev
      ? { pin: prev.pin, failedAttempts: prev.failedAttempts, lockedUntil: prev.lockedUntil }
      : null
    return fromRtdb(id, flatsObj[id] || {}, i, prevAuth)
  })
}

// App flat → the RTDB fields the hardware/app share (auth + meta are omitted;
// meter readings are hardware-owned so we don't write them back).
export function toRtdbWrite(f) {
  return {
    balance: +Number(f.balance).toFixed(2),
    relayOn: Boolean(f.relayOn),
    emergencyUsed: Boolean(f.emergencyUsed),
    emergencyOwed: +Number(f.emergencyOwed).toFixed(2),
    dailyEnergy: +Number(f.dailyEnergy).toFixed(4),
    totalEnergy: +Number(f.totalEnergy).toFixed(4),
  }
}
