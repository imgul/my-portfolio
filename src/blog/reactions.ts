/**
 * Likes / dislikes, stored in Supabase (project "gul-blog").
 * The publishable key is safe to ship: the table has RLS with no policies and
 * readers can only call two narrow SECURITY DEFINER functions (see
 * supabase/migrations/…_blog_reactions.sql). Override with VITE_SUPABASE_URL /
 * VITE_SUPABASE_PUBLISHABLE_KEY, or set them to "" to disable shared counts.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { setVote, visitorId } from './store'

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://okcynutijcqzftegrsci.supabase.co'
const KEY_ = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'sb_publishable_p9k8o3XsIHqv31yFPVx4MA_7UgL-f2C'
export const reactionsEnabled = !!(URL_ && KEY_)

export interface Counts {
  likes: number
  dislikes: number
}

const cache = new Map<string, Counts>()
const listeners = new Set<() => void>()
let version = 0
const emit = () => {
  version++
  listeners.forEach((l) => l())
}

async function rpc<T>(fn: string, body: unknown): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY_, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.text()) || res.statusText)
  return res.json()
}

const pending = new Set<string>()
export async function loadCounts(slugs: string[]) {
  if (!reactionsEnabled) return
  const need = slugs.filter((s) => !cache.has(s) && !pending.has(s))
  if (!need.length) return
  need.forEach((s) => pending.add(s))
  try {
    const rows = await rpc<{ slug: string; likes: number; dislikes: number }[]>('reaction_counts', { p_slugs: need })
    for (const s of need) cache.set(s, { likes: 0, dislikes: 0 })
    for (const r of rows) cache.set(r.slug, { likes: Number(r.likes), dislikes: Number(r.dislikes) })
    emit()
  } catch {
    /* offline or blocked: the buttons still work locally */
  } finally {
    need.forEach((s) => pending.delete(s))
  }
}

/**
 * Cast / change / remove (0) a vote. Optimistic: the UI updates at once and is
 * reconciled with the server's counts; on failure the vote is rolled back.
 */
export async function react(slug: string, value: 1 | -1 | 0, prev: 1 | -1 | 0, reason?: string): Promise<boolean> {
  setVote(slug, value)
  const before = cache.get(slug)
  const c = { ...(before ?? { likes: 0, dislikes: 0 }) }
  if (prev === 1) c.likes--
  if (prev === -1) c.dislikes--
  if (value === 1) c.likes++
  if (value === -1) c.dislikes++
  cache.set(slug, { likes: Math.max(0, c.likes), dislikes: Math.max(0, c.dislikes) })
  emit()
  if (!reactionsEnabled) return true
  try {
    const [row] = await rpc<{ likes: number; dislikes: number; my_value: number | null }[]>('react', {
      p_slug: slug,
      p_visitor: visitorId(),
      p_value: value,
      p_reason: reason ?? null,
    })
    if (row) {
      cache.set(slug, { likes: Number(row.likes), dislikes: Number(row.dislikes) })
      emit()
    }
    return true
  } catch {
    setVote(slug, prev)
    if (before) cache.set(slug, before)
    else cache.delete(slug)
    emit()
    return false
  }
}

/** Send (or update) the optional "what could be better?" note for an existing vote. */
export async function sendReason(slug: string, value: 1 | -1, reason: string) {
  if (!reactionsEnabled) return false
  try {
    await rpc('react', { p_slug: slug, p_visitor: visitorId(), p_value: value, p_reason: reason.slice(0, 600) })
    return true
  } catch {
    return false
  }
}

export function useCounts(slugs: string[]) {
  const key = slugs.join(',')
  useEffect(() => {
    if (key) loadCounts(key.split(','))
  }, [key])
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => version,
    () => 0,
  )
  return (slug: string) => cache.get(slug)
}
