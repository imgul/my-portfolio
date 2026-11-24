import { posts as ALL, SITE_URL } from 'virtual:blog'

export type Category = 'Founder' | 'Engineering' | 'AI Research' | 'Writing'
export type Art = 'galaxy' | 'dna' | 'road' | 'city' | 'book' | 'stack' | 'network' | 'tree' | 'mountains' | 'globe'

export interface Reference {
  id: string
  title: string
  authors?: string
  year?: string
  venue?: string
  url?: string
}

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  updated?: string
  category: Category
  tags: string[]
  series?: string
  seriesPart?: number
  featured: boolean
  draft: boolean
  art: Art
  level?: 'Beginner' | 'Intermediate' | 'Advanced'
  references: Reference[]
  words: number
  minutes: number
}

export const posts: PostMeta[] = ALL
export { SITE_URL }

export const CATEGORIES: { id: Category; blurb: string }[] = [
  { id: 'Founder', blurb: 'Building companies: validation, distribution, pricing, hiring.' },
  { id: 'Engineering', blurb: 'Laravel, React, SaaS architecture and shipping production systems.' },
  { id: 'AI Research', blurb: 'RAG, agents, evaluation and what actually works with LLMs.' },
  { id: 'Writing', blurb: 'The craft of explaining technical work clearly.' },
]

export const CATEGORY_COLOR: Record<Category, string> = {
  Founder: '#ff9d5c',
  Engineering: '#5b8cff',
  'AI Research': '#c46bff',
  Writing: '#3dd6a0',
}

export const getPost = (slug: string) => posts.find((p) => p.slug === slug)

export const featuredPost = () => posts.find((p) => p.featured) ?? posts[0]

export function seriesOf(p: PostMeta) {
  if (!p.series) return []
  return posts.filter((q) => q.series === p.series).sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0))
}

export function allSeries() {
  const map = new Map<string, PostMeta[]>()
  for (const p of posts) if (p.series) map.set(p.series, [...(map.get(p.series) ?? []), p])
  return [...map.entries()].map(([name, list]) => ({ name, posts: list.sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0)) }))
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

export const formatDate = (d: string, style: 'long' | 'short' = 'long') =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: style, year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')

export const postUrl = (p: PostMeta) => `/blog/${p.slug}`
