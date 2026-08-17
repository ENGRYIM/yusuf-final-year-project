# Smart Prepaid Energy System — Web Dashboard

Web dashboard for the smart prepaid energy system: a Building Monitor for the
landlord and a per-flat Tenant Portal for recharging, transferring and borrowing
credit.

Yusuf Ibn Musa · 2021/1/81460EE · FUT Minna, EEE Dept.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase values
npm run dev
```

`npm run build` produces the production bundle in `dist/`, `npm run lint` runs
oxlint.

## Where the data comes from

**Every figure on screen comes from Firebase Realtime Database.** There is no
simulation and no sample data: if the device has not published anything, the
dashboard says so and waits. That means you can leave it running before the
hardware is ready and it will populate the moment the first write lands.

The screen you get when data is missing tells you which case you are in:

| State | Meaning |
| --- | --- |
| Firebase is not configured | No `VITE_FIREBASE_*` values in `.env.local` |
| Connecting to the meter | Subscribed, first snapshot not in yet |
| Waiting for meter data | Connected, but the `flats` node is empty |
| Could not read the meter data | Read failed — check rules, URL, network |

Credit operations (recharge, transfer, borrow) are refused unless live data is
streaming, so a top-up can never be applied to numbers only the browser can see.

## Database shape

The dashboard reads `flats` and `settings`, and writes back only the fields it
owns (balance, relay, emergency credit, energy counters). Meter readings are
hardware-owned — the app never writes them.

```
flats/
  flat1/
    name          "Flat 1"        string
    balance       500.0           NGN, credit remaining
    relayOn       true            supply connected
    voltage       220.1           V   ─┐
    current       1.36            A    ├─ live meter reading
    powerW        300.0           W   ─┘
    dailyEnergy   2.5             kWh consumed today
    totalEnergy   61.44           kWh consumed lifetime
    monthly/
      2026-08/
        energyKWh   31.24         kWh consumed that month
        billed      1562          NGN (optional — derived at the tariff if absent)
        recharged   2000          NGN topped up that month (optional)
settings/
  borrowLimit     100000          NGN, max emergency credit (seeded if missing)
```

Notes:

- Flat keys sort naturally (`flat1`, `flat2`, … `flat10`), and a missing field
  reads as zero rather than blanking the UI.
- `relayOn: false` forces the displayed load to 0 W / 0 A regardless of the last
  `powerW` sample, so a cut-off flat never appears to be drawing power.
- `totalEnergy` falls back to `dailyEnergy` when absent.
- Month keys are `YYYY-MM`; anything else is ignored.

## Tariff and credit

The tariff is **₦50/kWh** (`TARIFF_RATE` in `src/lib/constants.js`). Credit and
energy are two views of the same thing: a ₦500 recharge buys 10 kWh of units,
which is what the top-up panel shows before you commit.

## Access and privacy

- **Tenant Portal** — each flat signs in with its own 4-digit PIN. A signed-in
  tenant receives only their own flat: other flats' balances, loads, PINs and
  transactions never reach the tenant's browser. Flat names are shared only so a
  transfer recipient can be picked.
- **Building Monitor** — aggregates every flat, so it sits behind the
  administrator PIN (`ADMIN_PIN` in `src/lib/constants.js`).
- **PINs** — a flat starts on the default `0000` and the tenant changes it from
  their portal. A changed PIN is stored on that device and cannot be read back by
  anyone, including the administrator; the monitor only shows whether a flat is
  still on the default. If a tenant forgets theirs, the administrator's *Reset all
  tenant PINs* restores the default. On the device itself the firmware holds
  SHA-256 hashes — hashing belongs there, not in the browser.
