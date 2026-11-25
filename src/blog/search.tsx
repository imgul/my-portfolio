/**
 * Blog search, shared by the search dialog (every page) and the filter bar on /blog.
 *
 * Two layers:
 *  - metadata (title, tags, category, series, description, headings): always available
 *  - full text by section (virtual:blog-search): loaded on demand with loadSearchIndex(),
 *    so typing "tenant_id" finds the paragraph and links straight to its section
 *
 * Every query word has to match somewhere in the post (AND). Matches in the title
 * count most, then tags, description, headings, body.
 */
import { useEffect, useState } from 'react'
import { posts as allPosts, type PostMeta } from './data'
import { optionalAllowed } from '../lib/consent/consent'

export type Section = { id: string; h: string; t: string }
export type SectionIndex = Record<string, Section[]>
export type SectionHit = { id: string; h: string; snippet: string }
export type Hit = { p: PostMeta; score: number; sections: SectionHit[] }

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
export const words = (q: string) => norm(q).split(/[\s,]+/).filter(Boolean)

/** "posts" also finds "post", "queues" finds "queue". */
const forms = (w: string) => (w.length > 4 && /[^s]s$/.test(w) ? [w, /(ss|ch|sh|x)es$/.test(w) ? w.slice(0, -2) : w.slice(0, -1)] : [w])
const has = (hay: string, w: string) => forms(w).some((f) => hay.includes(f))
/** normalised text, plus a copy without hyphens so "multitenant" finds "multi-tenant" */
const prep = (s: string) => {
  const n = norm(s)
  return n.includes('-') ? `${n} ${n.replace(/-/g, '')}` : n
}

/* ------------------------------------------------------------- the index */

let index: SectionIndex | null = null
let loading: Promise<SectionIndex> | null = null
const subs = new Set<(i: SectionIndex) => void>()

/** Loads the full-text index once (a separate ~20 kB gzip chunk). */
export function loadSearchIndex(): Promise<SectionIndex> {
  if (index) return Promise.resolve(index)
  loading ??= import('virtual:blog-search').then((m) => {
    index = m.sections
    subs.forEach((f) => f(m.sections))
    return m.sections
  })
  return loading
}

/** The full-text index, or null until it has loaded. Starts loading when `enabled`. */
export function useSearchIndex(enabled: boolean) {
  const [i, setI] = useState<SectionIndex | null>(index)
  useEffect(() => {
    if (index) return setI(index)
    subs.add(setI)
    if (enabled) loadSearchIndex().catch(() => {})
    return () => {
      subs.delete(setI)
    }
  }, [enabled])
  return i
}

/* ---------------------------------------------------------------- search */

/** ~160 characters around the first query word, cut at word boundaries. */
export function snippet(text: string, ws: string[], len = 160) {
  const n = norm(text)
  let at = -1
  for (const w of ws) {
    for (const f of forms(w)) {
      const i = n.indexOf(f)
      if (i >= 0 && (at < 0 || i < at)) at = i
    }
  }
  if (at < 0) return text.length > len ? text.slice(0, text.lastIndexOf(' ', len)) + '…' : text
  let start = Math.max(0, at - Math.round(len * 0.3))
  if (start > 0) start = text.indexOf(' ', start) + 1 || start
  let end = Math.min(text.length, start + len)
  if (end < text.length) end = text.lastIndexOf(' ', end) > start ? text.lastIndexOf(' ', end) : end
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export function search(q: string, sections: SectionIndex | null = index, list: PostMeta[] = allPosts): Hit[] {
  const ws = words(q)
  if (!ws.length) return list.map((p) => ({ p, score: 1, sections: [] }))
  const phrase = norm(q).trim()
  const out: Hit[] = []
  for (const p of list) {
    const title = prep(p.title)
    const meta = prep(`${p.category} ${p.tags.join(' ')} ${p.series ?? ''} ${p.level ?? ''}`)
    const desc = prep(p.description)
    const secs = sections?.[p.slug] ?? p.headings.map((h) => ({ id: h.id, h: h.text, t: '' }))
    const nsecs = secs.map((s) => ({ s, h: prep(s.h), t: prep(s.t) }))
    let score = 0
    let ok = true
    for (const w of ws) {
      const inTitle = has(title, w)
      const t = inTitle ? (new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title) ? 10 : 7) : has(meta, w) ? 4 : has(desc, w) ? 3 : nsecs.some((x) => has(x.h, w)) ? 2 : nsecs.some((x) => has(x.t, w)) ? 1 : 0
      if (!t) {
        ok = false
        break
      }
      score += t
    }
    if (!ok) continue
    if (ws.length > 1 && title.includes(phrase)) score += 6
    // the sections that match best (most query words, heading matches first)
    const ranked = nsecs
      .map((x) => ({ x, n: ws.filter((w) => has(x.h, w)).length * 2 + ws.filter((w) => has(x.t, w)).length }))
      .filter((r) => r.n > 0 && (r.x.s.h || r.x.s.t))
      .sort((a, b) => b.n - a.n)
      .slice(0, 2)
    out.push({ p, score, sections: ranked.map(({ x }) => ({ id: x.s.id, h: x.s.h, snippet: x.s.t ? snippet(x.s.t, ws) : '' })) })
  }
  return out.sort((a, b) => b.score - a.score || (a.p.date < b.p.date ? 1 : -1))
}

/* ------------------------------------------------------------ did you mean */

function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

let vocab: Map<string, number> | null = null
let vocabFrom: SectionIndex | null = null
function vocabulary(sections: SectionIndex | null) {
  if (vocab && vocabFrom === sections) return vocab
  vocab = new Map()
  vocabFrom = sections
  const add = (s: string, weight: number) => {
    for (const w of norm(s).match(/[a-z0-9_]+(?:-[a-z0-9_]+)*/g) ?? []) {
      if (w.length < 4) continue
      vocab!.set(w, (vocab!.get(w) ?? 0) + weight)
    }
  }
  for (const p of allPosts) {
    add(`${p.title} ${p.tags.join(' ')} ${p.category} ${p.series ?? ''}`, 20)
    add(p.description, 5)
    add(p.headings.map((h) => h.text).join(' '), 5)
    for (const s of sections?.[p.slug] ?? []) add(s.t, 1)
  }
  return vocab
}

/** A corrected query when some words match nothing ("multitenent" → "multi-tenant"), or null. */
export function didYouMean(q: string, sections: SectionIndex | null = index): string | null {
  const v = vocabulary(sections)
  let changed = false
  const fixed = words(q).map((w) => {
    if (w.length < 4 || [...v.keys()].some((k) => k.includes(w) || k.replace(/-/g, '').includes(w))) return w
    const max = w.length >= 7 ? 2 : 1
    let best = ''
    let bestD = max + 1
    let bestF = 0
    for (const [k, f] of v) {
      // compare without hyphens ("multitenent" ~ "multi-tenant"), suggest the real spelling
      const d = distance(w, k.replace(/-/g, ''), max)
      if (d <= max && (d < bestD || (d === bestD && f > bestF))) [best, bestD, bestF] = [k, d, f]
    }
    if (!best) return w
    changed = true
    return best
  })
  return changed ? fixed.join(' ') : null
}

/* ------------------------------------------------------------- highlight */

/** Highlight query words in a string with <mark>. */
export function Hl({ text, q }: { text: string; q: string }) {
  const ws = words(q)
    .flatMap(forms)
    .filter((w) => w.length > 1)
  if (!ws.length) return <>{text}</>
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")).join('|')})`, 'ig')
  const parts = text.split(re)
  return <>{parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
}

/* --------------------------------------------------------- recent queries */

const RECENT = 'gul:recent-searches'
export function recentSearches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}
export function rememberSearch(q: string) {
  const t = q.trim()
  // a convenience, so only after the visitor accepted (src/lib/consent)
  if (t.length < 2 || !optionalAllowed()) return
  try {
    localStorage.setItem(RECENT, JSON.stringify([t, ...recentSearches().filter((x) => norm(x) !== norm(t))].slice(0, 5)))
  } catch {
    /* private mode */
  }
}
export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT)
  } catch {
    /* ignore */
  }
}
