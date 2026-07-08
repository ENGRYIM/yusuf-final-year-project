import { useCallback, useEffect, useState } from 'react'

// Reads the class set by the inline script in index.html, then keeps
// <html>.dark and localStorage in sync when toggled.
export function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch (e) {}
  }, [dark])

  const toggle = useCallback(() => setDark((d) => !d), [])
  return { dark, toggle }
}
