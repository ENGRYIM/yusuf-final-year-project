// Mirrors the #define config block in SmartPrepaidEnergySystem.ino
export const TARIFF_RATE = 50.0 // NGN per kWh
export const LOW_BAL_WARN = 20.0 // NGN
export const EMERGENCY_AMT = 10.0 // NGN borrow limit
export const PIN_LENGTH = 4
export const MAX_PIN_ATTEMPTS = 3
export const LOCKOUT_MS = 30000 // 30 seconds
export const AP_SSID = 'SmartEnergySystem'
export const NOMINAL_VOLTAGE = 220.0 // V, mains nominal

// Landlord / administrator PIN. The Building Monitor aggregates every flat's
// credit and usage, so it sits behind this instead of being public.
export const ADMIN_PIN = '2468'

// Initial dummy state for the 3 flats (matches the firmware defaults).
// PINs here stand in for the SHA-256 hashes stored on the device.
// `meter.baseW` is the appliance load the flat draws; `powerW`/`current` are the
// instantaneous readings the meter reports and are recomputed every tick.
export const INITIAL_FLATS = [
  {
    name: 'Flat 1',
    pin: '1234',
    balance: 500.0,
    dailyEnergy: 0.0,
    totalEnergy: 0.0,
    relayOn: true,
    emergencyUsed: false,
    emergencyOwed: 0.0,
    failedAttempts: 0,
    lockedUntil: 0,
    meter: { voltage: 220.0, current: 1.36, powerW: 300.0, baseW: 300.0 }, // light load
  },
  {
    name: 'Flat 2',
    pin: '5678',
    balance: 250.0,
    dailyEnergy: 0.0,
    totalEnergy: 0.0,
    relayOn: true,
    emergencyUsed: false,
    emergencyOwed: 0.0,
    failedAttempts: 0,
    lockedUntil: 0,
    meter: { voltage: 220.0, current: 3.64, powerW: 800.0, baseW: 800.0 }, // heavy load
  },
  {
    name: 'Flat 3',
    pin: '9012',
    balance: 15.0,
    dailyEnergy: 0.0,
    totalEnergy: 0.0,
    relayOn: true,
    emergencyUsed: false,
    emergencyOwed: 0.0,
    failedAttempts: 0,
    lockedUntil: 0,
    meter: { voltage: 220.0, current: 2.5, powerW: 550.0, baseW: 550.0 }, // medium load
  },
]

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
