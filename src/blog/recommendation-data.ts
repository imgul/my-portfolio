export type ActivityKind = 'read' | 'skim' | 'save' | 'search' | 'share' | 'like' | 'dislike'
export interface Activity {
  kind: ActivityKind
  slug: string
  at: number
  strength: number
}

export const RECOMMENDATION_KEY = 'gul:recommendations:v2'
export const RECOMMENDATION_MAX_AGE = 90 * 24 * 60 * 60 * 1000
export const RECOMMENDATION_MAX_EVENTS = 100
const kinds = new Set<ActivityKind>(['read', 'skim', 'save', 'search', 'share', 'like', 'dislike'])

/** Local data is untrusted: validate, deduplicate, expire and bound it before using it. */
export function parseActivities(raw: string | null, now = Date.now()): Activity[] {
  try {
    if (!raw || raw.length > 128_000) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid = parsed
      .filter((x): x is Activity => x && typeof x === 'object' && kinds.has(x.kind) && typeof x.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(x.slug) &&
        typeof x.at === 'number' && Number.isFinite(x.at) && x.at <= now && x.at >= now - RECOMMENDATION_MAX_AGE &&
        typeof x.strength === 'number' && Number.isFinite(x.strength) && x.strength > 0 && x.strength <= 1)
      .sort((a, b) => b.at - a.at)
    const seen = new Set<string>()
    return valid.filter((e) => {
      const key = `${e.kind}:${e.slug}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, RECOMMENDATION_MAX_EVENTS).map(({ kind, slug, at, strength }) => ({ kind, slug, at, strength }))
  } catch {
    return []
  }
}
