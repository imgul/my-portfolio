/** Reader preferences: theme, text size, font and line width. Saved per visitor. */
import { useSyncExternalStore } from 'react'

export type Theme = 'auto' | 'light' | 'sepia' | 'dark'
export interface Prefs {
  theme: Theme
  size: 0 | 1 | 2 | 3
  font: 'serif' | 'sans'
  width: 'normal' | 'wide'
}

const KEY = 'gul:blog-prefs'
const DEFAULTS: Prefs = { theme: 'auto', size: 1, font: 'serif', width: 'normal' }

let prefs: Prefs = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
})()
const listeners = new Set<() => void>()

const media = window.matchMedia('(prefers-color-scheme: light)')
export const resolvedTheme = (t = prefs.theme) => (t === 'auto' ? (media.matches ? 'light' : 'dark') : t)

export function applyPrefs() {
  const el = document.documentElement
  el.dataset.theme = resolvedTheme()
  el.dataset.size = String(prefs.size)
  el.dataset.font = prefs.font
  el.dataset.width = prefs.width
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', { light: '#fbfaf7', sepia: '#f4ecd8', dark: '#0c0c10' }[resolvedTheme()] ?? '#0c0c10')
}
media.addEventListener('change', () => {
  applyPrefs()
  listeners.forEach((l) => l())
})

export function setPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* private mode */
  }
  applyPrefs()
  listeners.forEach((l) => l())
}

export function usePrefs() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => prefs,
  )
}
