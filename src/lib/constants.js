// Mirrors the #define config block in SmartPrepaidEnergySystem.ino
export const TARIFF_RATE = 50.0 // NGN per kWh
export const LOW_BAL_WARN = 20.0 // NGN
// Fallback used only until the live limit is read from Firebase
// (settings/borrowLimit) — or when Firebase is unconfigured/offline.
export const DEFAULT_BORROW_LIMIT = 100000.00 // NGN
export const PIN_LENGTH = 4
export const MAX_PIN_ATTEMPTS = 3
export const LOCKOUT_MS = 30000 // 30 seconds
export const AP_SSID = 'SmartEnergySystem'

// Landlord / administrator PIN. The Building Monitor aggregates every flat's
// credit and usage, so it sits behind this instead of being public.
export const ADMIN_PIN = '2468'

// Flats and their readings come from Realtime Database only — there is no
// built-in flat list. A flat the tenant has not given a PIN to yet falls back
// to this, mirroring a freshly flashed device.
export const DEFAULT_FLAT_PIN = '0000'

export const naira = (v, dec = 2) =>
  '₦' + Number(v).toLocaleString('en-NG', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })

// Credit ↔ energy units. A prepaid meter sells kWh, so every naira figure has an
// energy equivalent at the tariff: ₦50 buys 1 kWh.
export const unitsFor = (amountNgn) => Number(amountNgn) / TARIFF_RATE
export const costOf = (kWh) => Number(kWh) * TARIFF_RATE
export const kwh = (v, dec = 2) => Number(v).toFixed(dec) + ' kWh'
export const TARIFF_LABEL = `${naira(TARIFF_RATE, 0)}/kWh`

// Monthly records are keyed 'YYYY-MM' in Realtime Database. Rendered as
// 'Aug 2026' without constructing a date from the key, which would drag the
// browser's timezone into what is meant to be a plain calendar month.
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
export const monthLabel = (key) => {
  const [y, m] = String(key).split('-')
  const name = MONTH_NAMES[Number(m) - 1]
  return name ? `${name} ${y}` : String(key)
}
export const currentMonthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
