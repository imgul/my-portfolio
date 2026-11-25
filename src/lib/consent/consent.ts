/**
 * Cookie / storage consent, shared by the portfolio and the blog.
 *
 * The site sets no cookies and runs no analytics. What it does keep is a few
 * items in localStorage. The ones that make a feature work (theme, saved posts,
 * the visitor id behind a like) are written regardless; the ones that are only
 * a convenience (recent searches, personalised suggestions, the link-preview cache) wait for "Accept optional".
 *
 * The choice itself is stored under `gul:consent` with a version number: bump
 * CONSENT_VERSION when the policy changes in a way people should see again.
 */
import { useSyncExternalStore } from 'react'

export type ConsentChoice = 'all' | 'essential'
export interface Consent {
  choice: ConsentChoice
  /** policy version the choice was made against */
  v: number
  /** ISO timestamp */
  at: string
}

export const CONSENT_KEY = 'gul:consent'
export const CONSENT_VERSION = 3
/** Convenience storage is written only after "Accept optional" and wiped on "Reject optional". */
export const OPTIONAL_KEYS = ['gul:recent-searches', 'gul:lp:v2', 'gul:recommendations:v1', 'gul:recommendations:v2'] as const

const CHANGE = 'gul:consent-change'
const OPEN = 'gul:consent-open'
const isBrowser = typeof window !== 'undefined'

let cacheRaw: string | null | undefined
let cache: Consent | null = null

function raw() {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

/** The saved choice, or null when the visitor hasn't chosen (or chose under an older policy). */
export function readConsent(): Consent | null {
  if (!isBrowser) return null
  const r = raw()
  if (r === cacheRaw) return cache
  cacheRaw = r
  try {
    const c = r ? (JSON.parse(r) as Consent) : null
    cache = c && (c.choice === 'all' || c.choice === 'essential') && c.v >= CONSENT_VERSION ? c : null
  } catch {
    cache = null
  }
  return cache
}

export function saveConsent(choice: ConsentChoice) {
  const c: Consent = {
    choice,
    v: CONSENT_VERSION,
    at: new Date().toISOString(),
  }
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(c))
    // Old scroll-only profiles cannot be compared with active-reading signals.
    localStorage.removeItem('gul:recommendations:v1')
    if (choice === 'essential') for (const k of OPTIONAL_KEYS) localStorage.removeItem(k)
  } catch {
    /* storage blocked: the banner will simply ask again next visit */
  }
  window.dispatchEvent(new Event(CHANGE))
}

/** Forget the choice (the banner shows again). */
export function clearConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE))
}

/** True only after "Accept": gate convenience storage on this. */
export const optionalAllowed = () => readConsent()?.choice === 'all'

/** Show the banner again so the visitor can change their mind (footer "Cookie settings"). */
export const openConsent = () => window.dispatchEvent(new Event(OPEN))

export function onConsentOpen(fn: () => void) {
  window.addEventListener(OPEN, fn)
  return () => window.removeEventListener(OPEN, fn)
}

function subscribe(fn: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_KEY || e.key === null) fn()
  }
  window.addEventListener(CHANGE, fn)
  window.addEventListener('storage', onStorage) // another tab chose
  return () => {
    window.removeEventListener(CHANGE, fn)
    window.removeEventListener('storage', onStorage)
  }
}

/** The current choice; always null during server rendering and hydration. */
export function useConsent() {
  return useSyncExternalStore(subscribe, readConsent, () => null)
}
