// Types for the plain-JS blog build helpers used by vite.config.ts.
export const SITE_URL: string
export const POSTS_DIR: string
export const BLOG_TITLE: string
export const BLOG_DESCRIPTION: string
export const BLOG_INDEX_TITLE: string
export const RESEARCH_DESCRIPTION: string
export const NOT_FOUND_DESCRIPTION: string
export function loadPosts(dir?: string, opts?: { includeDrafts?: boolean }): (Record<string, unknown> & { slug: string; cover?: { style: string; alt?: string } & Record<string, unknown> })[]
export function coverVersions(): Record<string, string>
export const COVER_STYLES: string[]
export const PUBLISH_TZ: string
export function todayISO(): string
export function isPublished(post: Record<string, unknown>, today?: string): boolean
