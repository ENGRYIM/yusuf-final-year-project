// Translates between the Realtime Database flat record and the nested shape the
// UI components expect. RTDB stores meter fields flat (voltage/current/powerW);
// the app groups them under `meter`. PIN/lockout state has no RTDB counterpart
// (it's device-side auth), so it's kept client-side and merged back in here.
import { INITIAL_FLATS } from '@/lib/constants'
import { loadPins } from '@/lib/pinStore'

// Client-only auth defaults, indexed to line up with the RTDB flat order.
// A PIN the tenant set themselves wins over the demo default — otherwise going
// live (or reloading) would quietly hand their flat back to the factory PIN.
const authDefaults = (i, id) => ({
  pin: loadPins()[id] ?? INITIAL_FLATS[i]?.pin ?? '0000',
  failedAttempts: 0,
  lockedUntil: 0,
})

// RTDB record → app flat. `prevAuth` carries forward client-side auth state so a
// live update from the hardware doesn't wipe a flat's failed attempts / lockout.
export function fromRtdb(id, r, index, prevAuth) {
  const auth = prevAuth ?? authDefaults(index, id)
  const dailyEnergy = Number(r.dailyEnergy) || 0
  // Hardware readings: an open relay must read no load regardless of what the
  // last sample said, so the UI never shows power flowing to a cut-off flat.
  const relayOn = Boolean(r.relayOn)
  const powerW = relayOn ? Number(r.powerW) || 0 : 0
  const voltage = Number(r.voltage) || 0
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
    meter: {
      voltage,
      current: relayOn ? Number(r.current) || 0 : 0,
      powerW,
      // The flat's load profile, kept even while the relay is open so the
      // offline simulation has something to fall back to.
      baseW: Number(r.powerW) || 0,
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
    return fromRtdb(id, flatsObj[id], i, prevAuth)
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
