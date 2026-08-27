import { useEffect, useState } from 'react'

// A clock that ticks, so age-based UI re-renders on its own.
//
// Freshness is the one thing on this dashboard that changes without any new
// data arriving: a meter going quiet produces no snapshot to react to, so
// without a tick the "Live" badge would stay up indefinitely on a dead board —
// which is the failure this is meant to catch.
export default function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
