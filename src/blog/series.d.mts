// Types for src/blog/series.mjs
export interface SeriesStage {
  title: string
  description?: string
  position: number
}

export interface PlannedPost {
  position: number
  title: string
  stage?: string
  scheduledDate?: string
}

export interface SeriesInfo {
  slug: string
  title: string
  subtitle?: string
  description: string
  introduction?: string
  plannedPostCount?: number
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  cadence?: string
  seoTitle?: string
  seoDescription?: string
  stages: SeriesStage[]
  plannedPosts: PlannedPost[]
}

export const SERIES_STATUSES: string[]
export const SERIES: SeriesInfo[]
export function slugify(s: string): string
export function seriesBySlug(slug: string): SeriesInfo | undefined
export function publishedSeries(): SeriesInfo[]
export function seriesUrl(s: { slug: string }): string
export function seriesOgKey(s: { slug: string }): string
