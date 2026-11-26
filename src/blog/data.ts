import { posts as ALL, SITE_URL, SEO } from 'virtual:blog'
import type { LicenseId } from './scholar.mjs'
import { SERIES, seriesBySlug, slugify, type SeriesInfo } from './series.mjs'

export type { PlannedPost, SeriesInfo, SeriesStage } from './series.mjs'

export type Category = 'Founder' | 'Engineering' | 'AI Research' | 'Writing'
export type Art = 'galaxy' | 'dna' | 'road' | 'city' | 'book' | 'stack' | 'network' | 'tree' | 'mountains' | 'globe'

export interface Reference {
  id: string
  title: string
  authors?: string
  year?: string
  venue?: string
  url?: string
  doi?: string
}

export interface PostMeta {
  slug: string
  title: string
  description: string
  /** optional shorter <title> for search results */
  seoTitle?: string
  date: string
  updated?: string
  category: Category
  tags: string[]
  /** display name, resolved from the series registry (src/blog/series.mjs) */
  series?: string
  /** the series key: seriesSlug frontmatter, or the slug of the legacy `series` name */
  seriesSlug?: string
  seriesPart?: number
  /** stage title within the series (must match a stage in the registry) */
  seriesStage?: string
  featured: boolean
  draft: boolean
  /** dated in the future: visible in dev only, published on its date */
  scheduled?: boolean
  art: Art
  /** featured image at /covers/<slug>.webp (scripts/covers.mjs); without it the generative `art` is used */
  cover?: { style: string; alt: string; v?: string }
  level?: 'Beginner' | 'Intermediate' | 'Advanced'
  references: Reference[]
  faq: { q: string; a: string }[]
  /** CC-BY-4.0 for AI Research, Engineering and Writing by default (see scholar.mjs) */
  license: LicenseId
  /** e.g. 10.59350/abcde-12345, minted by Rogue Scholar for open posts */
  doi?: string
  headings: { depth: 2 | 3; text: string; id: string }[]
  words: number
  minutes: number
}

export const posts: PostMeta[] = ALL
export { SITE_URL, SEO }

export const CATEGORIES: { id: Category; audience: string; blurb: string; glyph: string }[] = [
  { id: 'Founder', audience: 'Founders', blurb: 'Building companies: validation, distribution, pricing and hiring.', glyph: '◆' },
  { id: 'Engineering', audience: 'Engineers', blurb: 'Laravel, React, SaaS architecture and shipping production systems.', glyph: '{ }' },
  { id: 'AI Research', audience: 'AI researchers', blurb: 'RAG, agents, evaluation and what actually works with LLMs.', glyph: '✲' },
  { id: 'Writing', audience: 'Technical writers', blurb: 'The craft of explaining technical work clearly.', glyph: '¶' },
]

/** Muted, eye-friendly category hues (text uses a contrast-safe mix of these, see blog.css). */
export const CATEGORY_COLOR: Record<Category, string> = {
  Founder: '#d4834f',
  Engineering: '#5a84d6',
  'AI Research': '#9a6fd1',
  Writing: '#3a9c7c',
}

export const getPost = (slug: string) => posts.find((p) => p.slug === slug)

export const featuredPost = () => posts.find((p) => p.featured) ?? posts[0]

/** The series a post belongs to, by slug (a post belongs to zero or one series). */
export const postSeriesSlug = (p: PostMeta) => p.seriesSlug ?? (p.series ? slugify(p.series) : undefined)

export const getSeries = (slug: string) => seriesBySlug(slug)

export const seriesUrl = (s: { slug: string }) => `/blog/series/${s.slug}`

/** Published parts of a series, in reading order. */
export function seriesPosts(slug: string) {
  return posts.filter((q) => postSeriesSlug(q) === slug).sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0))
}

export function seriesOf(p: PostMeta) {
  const slug = postSeriesSlug(p)
  return slug ? seriesPosts(slug) : []
}

/** The stage a post sits in, resolved against the registry (undefined when the series has no stages). */
export function stageOf(p: PostMeta) {
  const s = p.seriesSlug ? seriesBySlug(p.seriesSlug) : undefined
  if (!s || !p.seriesStage) return undefined
  return s.stages.find((st) => st.title === p.seriesStage)
}

/** A planned (not yet published) part, by position. */
export const plannedPart = (s: SeriesInfo, position: number) => s.plannedPosts.find((x) => x.position === position)

/** Total parts: the planned count, or the furthest known position when none is set. */
export function seriesTotal(s: SeriesInfo, published: number) {
  const furthest = Math.max(published, ...s.plannedPosts.map((x) => x.position), 0)
  return s.plannedPostCount ?? furthest
}

export interface SeriesWithPosts extends SeriesInfo {
  posts: PostMeta[]
}

/** Public series with their published parts (draft / scheduled / archived stay hidden). */
export function allSeries(): SeriesWithPosts[] {
  return SERIES.filter((s) => s.status === 'published').map((s) => ({ ...s, posts: seriesPosts(s.slug) }))
}

export function allTags() {
  const count = new Map<string, number>()
  for (const p of posts) for (const t of p.tags) count.set(t, (count.get(t) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** Related = shared tags (×2) + same category (×1), newest first on ties. */
export function related(p: PostMeta, n = 3) {
  return posts
    .filter((q) => q.slug !== p.slug)
    .map((q) => ({ q, score: q.tags.filter((t) => p.tags.includes(t)).length * 2 + (q.category === p.category ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.q.date < b.q.date ? 1 : -1))
    .slice(0, n)
    .map((x) => x.q)
}

/** Older/newer neighbours in chronological order. */
export function neighbours(p: PostMeta) {
  const i = posts.findIndex((q) => q.slug === p.slug)
  return { newer: i > 0 ? posts[i - 1] : undefined, older: i >= 0 && i < posts.length - 1 ? posts[i + 1] : undefined }
}

/** "founders", "engineers", "AI researchers": lower-case the audience but keep acronyms. */
export const audienceLower = (a: string) => a.replace(/^([A-Z])([a-z])/, (_, x: string, y: string) => x.toLowerCase() + y)

/** Total reading time across all posts, in minutes. */
export const totalMinutes = () => posts.reduce((n, p) => n + p.minutes, 0)

export const formatDate = (d: string, style: 'long' | 'short' = 'long') =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: style, year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')

export const postUrl = (p: PostMeta) => `/blog/${p.slug}`
