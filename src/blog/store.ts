/**
 * Everything the blog remembers about a reader lives on their device:
 * saved posts, reading progress, their own votes and an anonymous visitor id
 * (used only so one browser = one vote). Nothing here is sent anywhere
 * except the visitor id + vote when they press like / dislike.
 */
import { useSyncExternalStore } from 'react'
import { recordActivity, removeActivity } from './recommendation-history'

export interface Progress {
  /** 0..1 of the article read */
  p: number
  /** last scroll position */
  y: number
  /** last visit (ms) */
  t: number
  /** finished reading */
  done?: boolean
}
interface Data {
  visitor: string
  saved: string[]
  progress: Record<string, Progress>
  votes: Record<string, 1 | -1>
}

const KEY = 'gul:blog-reader'
const isBrowser = typeof window !== 'undefined'
const uuid = () =>
  isBrowser && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))

const EMPTY: Data = { visitor: '', saved: [], progress: {}, votes: {} }
let data: Data = (() => {
  if (!isBrowser) return EMPTY
  try {
    const d = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    if (!d.visitor) d.visitor = uuid()
    return d
  } catch {
    return { ...EMPTY, visitor: uuid() }
  }
})()

const listeners = new Set<() => void>()
function commit(next: Data) {
  data = next
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l())
}

export const visitorId = () => data.visitor

export function useReader() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => data,
    () => EMPTY,
  )
}

export function toggleSaved(slug: string) {
  const has = data.saved.includes(slug)
  commit({ ...data, saved: has ? data.saved.filter((s) => s !== slug) : [slug, ...data.saved] })
  if (has) removeActivity(slug, 'save')
  else recordActivity('save', slug)
  return !has
}

export function setProgress(slug: string, p: Partial<Progress>) {
  const prev = data.progress[slug] ?? { p: 0, y: 0, t: 0 }
  const next = { ...prev, ...p, t: Date.now() }
  if (next.done || next.p >= 1) {
    next.p = 1
    next.done = true
  }
  // keep the store small: only the 50 most recent posts
  const entries = Object.entries({ ...data.progress, [slug]: next }).sort((a, b) => b[1].t - a[1].t).slice(0, 50)
  commit({ ...data, progress: Object.fromEntries(entries) })
}

export function setVote(slug: string, v: 1 | -1 | 0) {
  const votes = { ...data.votes }
  if (v === 0) delete votes[slug]
  else votes[slug] = v
  commit({ ...data, votes })
}
