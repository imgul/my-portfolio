import { useSyncExternalStore } from 'react'
import { optionalAllowed, useConsent } from '../lib/consent/consent'
import { parseActivities, RECOMMENDATION_KEY, RECOMMENDATION_MAX_EVENTS, type Activity, type ActivityKind } from './recommendation-data'

export type { Activity, ActivityKind } from './recommendation-data'
const CHANGE = 'gul:recommendations-change'
const kinds = new Set<ActivityKind>(['read', 'save', 'search', 'share', 'like', 'dislike'])
const EMPTY: Activity[] = []
let cachedRaw: string | null | undefined
let cachedEvents: Activity[] = EMPTY

function rawHistory() {
  if (typeof window === 'undefined' || !optionalAllowed()) return null
  try {
    return localStorage.getItem(RECOMMENDATION_KEY)
  } catch {
    return null
  }
}

function snapshot() {
  const raw = rawHistory()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedEvents = raw ? parseActivities(raw) : EMPTY
  }
  return cachedEvents
}

function subscribe(fn: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === RECOMMENDATION_KEY || e.key === 'gul:consent' || e.key === null) fn()
  }
  window.addEventListener(CHANGE, fn)
  window.addEventListener('gul:consent-change', fn)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE, fn)
    window.removeEventListener('gul:consent-change', fn)
    window.removeEventListener('storage', onStorage)
  }
}

/** The server never sees a reader's history. Consent changes also trigger a re-render. */
export function useRecommendationHistory() {
  const consent = useConsent()
  const history = useSyncExternalStore(subscribe, snapshot, () => EMPTY)
  return { allowed: consent?.choice === 'all', history: consent?.choice === 'all' ? history : EMPTY }
}

function write(events: Activity[]) {
  try {
    localStorage.setItem(RECOMMENDATION_KEY, JSON.stringify(events.slice(0, RECOMMENDATION_MAX_EVENTS)))
    window.dispatchEvent(new Event(CHANGE))
  } catch {
    // Storage may be blocked; recommendations fall back to unpersonalised results.
  }
}

/** One latest event per post and kind; raw search queries and share destinations are not stored. */
export function recordActivity(kind: ActivityKind, slug: string, strength = 1) {
  if (!optionalAllowed() || !kinds.has(kind) || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug) || !Number.isFinite(strength) || strength <= 0) return
  const now = Date.now()
  const events = parseActivities(rawHistory(), now)
  const prior = events.find((e) => e.kind === kind && e.slug === slug)
  // Ignore repeated progress writes at the same milestone.
  if (kind === 'read' && prior && prior.strength >= strength && now - prior.at < 24 * 60 * 60 * 1000) return
  const value = kind === 'read' ? Math.max(prior?.strength ?? 0, strength) : strength
  write([{ kind, slug, at: now, strength: Math.min(1, value) }, ...events.filter((e) => e.kind !== kind || e.slug !== slug)])
}

export function removeActivity(slug: string, ...remove: ActivityKind[]) {
  if (!optionalAllowed()) return
  const events = parseActivities(rawHistory())
  const next = events.filter((e) => e.slug !== slug || !remove.includes(e.kind))
  if (next.length !== events.length) write(next)
}

/** Call only for explicit or settled searches; matches contain post slugs, not search text. */
export function recordSearchMatches(slugs: string[]) {
  for (const [i, slug] of [...new Set(slugs)].slice(0, 3).entries()) recordActivity('search', slug, 1 - i * 0.25)
}

export function clearRecommendationHistory() {
  try {
    localStorage.removeItem(RECOMMENDATION_KEY)
  } catch {
    // Storage may be blocked.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE))
}
