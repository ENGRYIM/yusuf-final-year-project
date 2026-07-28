// Firebase initialization — Realtime Database.
// Config is read from Vite env vars (VITE_*) so credentials stay out of source.
// Copy .env.example to .env.local and fill in the values from your Firebase
// project settings (Project settings → General → Your apps → SDK config).
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// True only when the essential connection values are present. When false the
// app skips Firebase entirely and runs on the local simulation fallback.
export const firebaseEnabled = Boolean(
  firebaseConfig.databaseURL && firebaseConfig.apiKey
)

let app = null
let db = null
if (firebaseEnabled) {
  app = initializeApp(firebaseConfig)
  db = getDatabase(app)
} else if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] No config found (VITE_FIREBASE_*). Running on local simulation fallback.'
  )
}

export { app, db }
