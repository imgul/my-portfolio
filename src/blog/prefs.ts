/**
 * Reader preferences: theme, contrast, text size, font, line spacing, width
 * and motion. Saved per visitor and applied to <html> as data-* attributes
 * (an inline script in index.html applies them before first paint).
 */
import { useSyncExternalStore } from 'react'

export type Theme = 'auto' | 'light' | 'sepia' | 'dim' | 'night'
export interface Prefs {
  theme: Theme
  contrast: 'normal' | 'high'
  size: 0 | 1 | 2 | 3 | 4
  font: 'serif' | 'sans' | 'legible'
  leading: 'tight' | 'normal' | 'loose'
  width: 'narrow' | 'normal' | 'wide'
  motion: 'auto' | 'reduce'
}

export const KEY = 'gul:blog-prefs'
export const DEFAULTS: Prefs = { theme: 'auto', contrast: 'normal', size: 1, font: 'serif', leading: 'normal', width: 'normal', motion: 'auto' }

/** Page background per theme (used for the browser UI colour). */
export const THEME_BG: Record<Exclude<Theme, 'auto'>, string> = {
  light: '#f8f6f1',
  sepia: '#f3ead8',
  dim: '#1c1d21',
  night: '#14110d',
}

const isBrowser = typeof window !== 'undefined'

let prefs: Prefs = (() => {
  if (!isBrowser) return DEFAULTS
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    // migrate the old "dark" theme to "dim"
    if (saved.theme === 'dark') saved.theme = 'dim'
    return { ...DEFAULTS, ...saved }
  } catch {
    return DEFAULTS
  }
})()
const listeners = new Set<() => void>()

const media = isBrowser ? window.matchMedia('(prefers-color-scheme: dark)') : null
export const resolvedTheme = (t = prefs.theme): Exclude<Theme, 'auto'> => (t === 'auto' ? (media?.matches ? 'dim' : 'light') : t)

export function applyPrefs() {
  if (!isBrowser) return
  const el = document.documentElement
  el.dataset.theme = resolvedTheme()
  el.dataset.contrast = prefs.contrast
  el.dataset.size = String(prefs.size)
  el.dataset.font = prefs.font
  el.dataset.leading = prefs.leading
  el.dataset.width = prefs.width
  el.dataset.motion = prefs.motion
  el.style.background = ''
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[resolvedTheme()])
}
media?.addEventListener('change', () => {
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

export const resetPrefs = () => setPrefs(DEFAULTS)

export function usePrefs() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => prefs,
    () => DEFAULTS,
  )
}

export const reduceMotion = () => prefs.motion === 'reduce' || (isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
