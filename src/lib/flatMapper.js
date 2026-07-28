// Translates between the Realtime Database flat record and the nested shape the
// UI components expect. RTDB stores meter fields flat (voltage/current/powerW);
// the app groups them under `meter`. PIN/lockout state has no RTDB counterpart
// (it's device-side auth), so it's kept client-side and merged back in here.
import { INITIAL_FLATS } from '@/lib/constants'

// Client-only auth defaults, indexed to line up with the RTDB flat order.
const authDefaults = (i) => ({
  pin: INITIAL_FLATS[i]?.pin ?? '0000',
  failedAttempts: 0,
  lockedUntil: 0,
})

// RTDB record → app flat. `prevAuth` carries forward client-side auth state so a
// live update from the hardware doesn't wipe a flat's failed attempts / lockout.
export function fromRtdb(id, r, index, prevAuth) {
  const auth = prevAuth ?? authDefaults(index)
  return {
    id, // RTDB key, e.g. 'flat1' — needed to address writes
    name: r.name ?? `Flat ${index + 1}`,
    balance: Number(r.balance) || 0,
    dailyEnergy: Number(r.dailyEnergy) || 0,
    relayOn: Boolean(r.relayOn),
    emergencyUsed: Boolean(r.emergencyUsed),
    emergencyOwed: Number(r.emergencyOwed) || 0,
    lastUpdated: r.lastUpdated ?? null,
    meter: {
      voltage: Number(r.voltage) || 0,
      current: Number(r.current) || 0,
      powerW: Number(r.powerW) || 0,
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
  }
}
