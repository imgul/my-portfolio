// Types for src/blog/scholar.mjs (shared by the build scripts and the browser).
export type LicenseId = 'CC-BY-4.0' | 'all-rights-reserved'
export interface License {
  id: LicenseId
  short: string
  name: string
  url: string
  open: boolean
  summary: string
}
export interface Profile {
  id: string
  label: string
  url: string
  research: boolean
}
export interface CitablePost {
  slug: string
  title: string
  description: string
  date: string
  updated?: string
  tags: string[]
  license: LicenseId
  doi?: string
  references?: { title: string; authors?: string; year?: string; venue?: string; url?: string; doi?: string }[]
}
export type CiteFormat = 'apa' | 'mla' | 'chicago' | 'ieee' | 'harvard' | 'bibtex' | 'ris'

export const ORCID: string
export const AUTHOR: {
  name: string
  givenName: string
  familyName: string
  citationName: string
  email: string
  jobTitle: string
  affiliation: string
  location: string
  orcid: string
  orcidUrl: string
  /** X handle without the @ */
  x: string
  knowsAbout: string[]
}
export const PROFILES: Profile[]
export function activeProfiles(research?: boolean): Profile[]
export function sameAs(): string[]
export const LICENSES: Record<LicenseId, License>
export const OPEN_CATEGORIES: string[]
export function licenseFor(category: string, override?: string): LicenseId
export const DOI_RE: RegExp
export function doiUrl(doi: string): string
export const BLOG_NAME: string
export function citeKey(p: CitablePost): string
export const CITE_FORMATS: { id: CiteFormat; label: string; file?: string; mime?: string }[]
export function citation(p: CitablePost, fmt: CiteFormat, site: string): string
export function citationMeta(p: CitablePost, site: string, opts?: { pdf?: boolean }): [string, string][]
