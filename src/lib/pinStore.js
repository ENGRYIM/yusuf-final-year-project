// Where a tenant's chosen PIN lives.
//
// On the device the firmware keeps SHA-256 hashes in NVS, so a PIN a tenant sets
// on the keypad survives a power cycle. The dashboard mirrors that with
// localStorage: without it "Change PIN" only edits React state, so the new PIN
// silently stops working on the next page load and the demo default starts
// working again — which is not a PIN change at all.
//
// Note this is the browser's copy of device-side auth. It is deliberately not
// written to Realtime Database: PINs are not building data and the landlord's
// monitor has no business reading them.
const KEY = 'spes.pins.v1'

// A stable per-flat key. Live records carry their RTDB key ('flat1'); the
// offline simulation has no id, so fall back to the same 1-based naming.
export const pinKey = (flat, index) => flat?.id || `flat${index + 1}`

export function loadPins() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    // Private-mode / disabled storage: fall back to demo PINs rather than break login.
    return {}
  }
}

export function savePin(key, pin) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPins(), [key]: pin }))
    return true
  } catch {
    return false
  }
}

// Used by "Reset demo data" — also the recovery path when a tenant forgets the
// PIN they set, since nothing else can read it back.
export function clearPins() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
