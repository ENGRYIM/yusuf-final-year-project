// How recently the meter published, per flat.
//
// The dashboard subscribes to Realtime Database, so it can be perfectly
// connected to Firebase while the ESP32 is unplugged: the last values simply
// sit there and nothing in the UI moves. `status === LIVE` therefore only says
// the *subscription* is healthy, never that the meter is alive. This module
// answers the second question from flats/<id>/lastUpdated.
//
// Thresholds come from MEASURING the live meter, never from a firmware constant.
// FIREBASE_SYNC_MS says 1000, but the period is really however long the sync
// call takes, so it has already been wrong by a factor of 32 once.
//
// Re-measured after the batching refactor (15 HTTPS round trips collapsed to
// one GET plus one multi-path PATCH): sampling every 2s for a minute gives a
// publish gap of 4-5s and a worst observed age of 6.7s, down from 34s.
//
// 20s is ~3x that worst case, so four consecutive missed publishes are tolerated
// before the UI says anything. 90s is ~18 intervals, and deliberately longer than
// two firmware WiFi retry cycles (WIFI_RETRY_MS 15s): a normal reassociation
// should read as a gap, not as "meter offline".
// Retune from a new measurement if the cadence changes again — not from a
// constant, and not below ~15s, since a slow hotspot moment can stretch a cycle.
export const FRESH_MS = 20_000 // under this: normal
export const STALE_MS = 90_000 // over this: the meter is gone, not just slow

// The device stamps lastUpdated from NTP; the browser reads its own clock. The
// two are independent, so a viewer whose laptop is set wrong would otherwise see
// a healthy meter as stale — or as updated in the future. Beyond this much
// "negative age" we blame the clocks rather than the meter.
const SKEW_TOLERANCE_MS = 120_000

export const FRESHNESS = {
  FRESH: 'fresh',
  DELAYED: 'delayed',
  STALE: 'stale',
  UNSYNCED: 'unsynced', // device up, NTP not yet acquired (lastUpdated === 0)
  SKEW: 'skew', // browser clock disagrees with the device's
  UNKNOWN: 'unknown', // field absent — old firmware or nothing published yet
}

// Bare duration: '4s', '3m', '2h'. Callers add 'ago' where it reads as a point
// in time; a span ("no reading for 3m") must not carry it.
export function ageLabel(ms) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.round(m / 60)}h`
}

// lastUpdated (epoch ms) → freshness state for one flat.
// `now` is passed in rather than read here so every flat in a render is judged
// against the same instant and the whole thing stays pure/testable.
export function meterFreshness(lastUpdated, now = Date.now()) {
  if (lastUpdated == null) {
    return {
      state: FRESHNESS.UNKNOWN,
      ageMs: null,
      label: 'No timestamp',
      detail: 'This meter has never published a reading time.',
      live: false,
    }
  }

  // The firmware deliberately emits 0 until NTP resolves — about 27s from power
  // on. Rendering that as a 1970 date (or '56 years ago') would read as a fault
  // when it is a normal part of every boot.
  if (lastUpdated === 0) {
    return {
      state: FRESHNESS.UNSYNCED,
      ageMs: null,
      label: 'Clock not synced',
      detail: 'The meter is publishing but has not acquired the time yet.',
      live: true,
    }
  }

  const ageMs = now - lastUpdated

  if (ageMs < -SKEW_TOLERANCE_MS) {
    return {
      state: FRESHNESS.SKEW,
      // No meaningful age when the clocks disagree — reporting one would show a
      // negative duration.
      ageMs: null,
      label: 'Clock mismatch',
      detail:
        'The meter reports a time ahead of this browser. Check this device’s clock — the meter itself may be fine.',
      live: true,
    }
  }

  // Small negative ages are just jitter between the two clocks; floor at 0 so
  // the UI never says '-2s ago'.
  const age = Math.max(0, ageMs)

  if (age > STALE_MS) {
    return {
      state: FRESHNESS.STALE,
      ageMs: age,
      label: 'Meter offline',
      detail: `No reading for ${ageLabel(age)}. Figures below are the last known values, not current ones.`,
      live: false,
    }
  }

  if (age > FRESH_MS) {
    return {
      state: FRESHNESS.DELAYED,
      ageMs: age,
      label: 'Delayed',
      detail: `Last reading ${ageLabel(age)} ago; the meter normally reports every second.`,
      live: true,
    }
  }

  return {
    state: FRESHNESS.FRESH,
    ageMs: age,
    label: 'Live',
    detail: `Updated ${ageLabel(age)} ago.`,
    live: true,
  }
}
