import type { PostMeta } from './data'
import type { Activity, ActivityKind } from './recommendation-history'

export interface Recommendation {
  post: PostMeta
  reason: string
  personalized: boolean
}

const DAY = 24 * 60 * 60 * 1000
const MAX_AGE = 90 * DAY
const SIGNAL: Record<ActivityKind, number> = { read: 1.2, skim: -0.45, save: 2.8, search: 0.85, share: 2, like: 2, dislike: -3 }
const STOP = new Set(['a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'with', 'your'])
const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [])

/** Hybrid content affinity: rare shared tags, title terms, category and series. */
function similarity(a: PostMeta, b: PostMeta, idf: Map<string, number>, titles: Map<string, Set<string>>) {
  const tags = new Set([...a.tags, ...b.tags])
  let shared = 0
  let union = 0
  for (const t of tags) {
    const w = idf.get(t) ?? 1
    union += w
    if (a.tags.includes(t) && b.tags.includes(t)) shared += w
  }
  const aa = titles.get(a.slug) ?? new Set<string>()
  const bb = titles.get(b.slug) ?? new Set<string>()
  const words = new Set([...aa, ...bb])
  let overlap = 0
  for (const w of aa) if (bb.has(w)) overlap++
  return 0.58 * (union ? shared / union : 0) + 0.12 * (words.size ? overlap / words.size : 0) + 0.12 * Number(a.category === b.category) + 0.18 * Number(!!a.series && a.series === b.series)
}

/**
 * On-device content-based ranking. Weights are heuristics, not learned claims about readers.
 * Recent interactions decay, dislikes reduce scores, and greedy diversity limits repeats.
 * Only the provided published catalogue can produce results; invalid/expired signals are ignored.
 */
export function recommendPosts(catalogue: PostMeta[], activities: Activity[], options: { context?: PostMeta; limit?: number; now?: number } = {}): Recommendation[] {
  const now = options.now ?? Date.now()
  const limit = Math.max(0, Math.min(12, options.limit ?? 3))
  const live = catalogue.filter((p) => !p.draft && !p.scheduled)
  const bySlug = new Map(live.map((p) => [p.slug, p]))
  const idf = new Map<string, number>()
  for (const p of live) for (const t of new Set(p.tags)) idf.set(t, (idf.get(t) ?? 0) + 1)
  for (const [t, count] of idf) idf.set(t, 1 + Math.log((live.length + 1) / (count + 1)))
  const titles = new Map(live.map((p) => [p.slug, tokens(p.title)]))
  const seen = new Set<string>()
  const signals = activities.filter(
    (e) => e && bySlug.has(e.slug) && Object.hasOwn(SIGNAL, e.kind) && Number.isFinite(e.at) && e.at <= now && e.at >= now - MAX_AGE && Number.isFinite(e.strength) && e.strength > 0 && e.strength <= 1,
  ).sort((a, b) => b.at - a.at).filter((e) => {
    const key = `${e.kind}:${e.slug}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 100)
  const excluded = new Set(signals.filter((e) => e.kind === 'save' || e.kind === 'dislike' || (e.kind === 'read' && e.strength >= 1)).map((e) => e.slug))
  if (options.context) excluded.add(options.context.slug)
  // Bound the combined influence of one post even when it has many signal types.
  const weights = new Map(signals.map((e) => [e, SIGNAL[e.kind] * e.strength * Math.pow(0.5, (now - e.at) / (30 * DAY))]))
  const perPost = new Map<string, number>()
  for (const e of signals) perPost.set(e.slug, (perPost.get(e.slug) ?? 0) + Math.abs(weights.get(e)!))
  for (const e of signals) weights.set(e, weights.get(e)! * Math.min(1, 4 / perPost.get(e.slug)!))
  const totalWeight = [...weights.values()].reduce((sum, weight) => sum + Math.abs(weight), 0)
  const context = options.context && bySlug.get(options.context.slug)

  const candidates = live.filter((p) => !excluded.has(p.slug)).map((post) => {
    let affinity = 0
    let strongest = 0
    let negative = false
    let why: Activity | undefined
    for (const e of signals) {
      const source = bySlug.get(e.slug)!
      if (source.slug === post.slug && e.kind !== 'search' && e.kind !== 'skim') continue
      const match = source.slug === post.slug ? 1 : similarity(source, post, idf, titles)
      const contribution = match * weights.get(e)!
      affinity += contribution
      if (contribution < -0.001) negative = true
      if (contribution > strongest) {
        strongest = contribution
        why = e
      }
    }
    const contextScore = context ? similarity(context, post, idf, titles) : 0
    const age = Math.max(0, (now - Date.parse(`${post.date}T00:00:00Z`)) / DAY)
    const freshness = Number.isFinite(age) ? Math.exp(-age / 180) : 0
    const next = context && context.series && context.series === post.series && context.seriesPart && post.seriesPart === context.seriesPart + 1 ? 0.18 : 0
    const score = (affinity / Math.max(1.5, totalWeight)) * 1.5 + contextScore * 0.65 + next + freshness * 0.08 + (post.featured ? 0.03 : 0)
    let reason = contextScore > 0 ? 'Related to this post' : 'Explore this topic'
    if (why && strongest > 0) {
      const source = bySlug.get(why.slug)!
      const reasons: Record<ActivityKind, string> = {
        read: `Related to “${source.title}”`,
        skim: 'Adjusted for your reading activity',
        save: `Because you saved “${source.title}”`,
        search: 'Related to a recent search',
        share: 'Related to a post you tried to share',
        like: `Because you liked “${source.title}”`,
        dislike: 'Related to your reading',
      }
      reason = reasons[why.kind]
    }
    if (!why && negative) reason = 'Adjusted for your reading activity or feedback'
    return { post, score, reason, personalized: !!why || negative }
  })
  const selected: typeof candidates = []
  while (candidates.length && selected.length < limit) {
    candidates.sort((a, b) => {
      const diversity = (item: typeof a) => selected.reduce((max, s) => Math.max(max, similarity(item.post, s.post, idf, titles)), 0)
      return (b.score - 0.22 * diversity(b)) - (a.score - 0.22 * diversity(a)) || b.post.date.localeCompare(a.post.date) || a.post.slug.localeCompare(b.post.slug)
    })
    selected.push(candidates.shift()!)
  }
  return selected.map(({ post, reason, personalized }) => ({ post, reason, personalized }))
}
