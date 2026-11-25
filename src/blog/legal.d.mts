// Types for src/blog/legal.mjs
export type LegalId = 'privacy' | 'terms' | 'cookies'
export interface LegalMeta {
  id: LegalId
  path: string
  title: string
  description: string
}
export const LEGAL_UPDATED: string
export const LEGAL: LegalMeta[]
export const LEGAL_PATHS: string[]
export function legalByPath(path: string): LegalMeta | undefined
