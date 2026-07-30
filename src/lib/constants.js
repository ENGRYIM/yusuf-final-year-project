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

// Initial dummy state for the 3 flats (matches the firmware defaults).
// PINs here stand in for the SHA-256 hashes stored on the device.
export const INITIAL_FLATS = [
  {
    name: 'Flat 1',
    pin: '1234',
    balance: 500.0,
    dailyEnergy: 0.0,
    relayOn: true,
    emergencyUsed: false,
    emergencyOwed: 0.0,
    failedAttempts: 0,
    lockedUntil: 0,
    meter: { voltage: 220.0, current: 1.4, powerW: 300.0 }, // light load
  },
  {
    name: 'Flat 2',
    pin: '5678',
    balance: 250.0,
    dailyEnergy: 0.0,
    relayOn: true,
    emergencyUsed: false,
    emergencyOwed: 0.0,
    failedAttempts: 0,
    lockedUntil: 0,
    meter: { voltage: 220.0, current: 3.6, powerW: 800.0 }, // heavy load
  },
  {
    name: 'Flat 3',
    pin: '9012',
    balance: 15.0,
    dailyEnergy: 0.0,
    relayOn: true,
    emergencyUsed: false,
    emergencyOwed: 0.0,
    failedAttempts: 0,
    lockedUntil: 0,
    meter: { voltage: 220.0, current: 2.5, powerW: 550.0 }, // medium load
  },
]

export const naira = (v, dec = 2) =>
  '₦' + Number(v).toLocaleString('en-NG', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
