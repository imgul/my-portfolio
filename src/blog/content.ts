/**
 * Post bodies (compiled MDX). In the browser each post is its own lazy chunk;
 * during pre-rendering (src/blog/ssr.tsx) every body is registered up front so
 * pages render synchronously. A body loaded once is cached, so hydration and
 * client-side navigation back to a post render instantly.
 */
import type { ComponentType } from 'react'

export type Body = ComponentType<{ components?: Record<string, unknown> }>

const loaders = import.meta.glob<{ default: Body }>('./posts/*.mdx')
const cache = new Map<string, Body>()

export const hasPost = (slug: string) => `./posts/${slug}.mdx` in loaders
export const getBody = (slug: string) => cache.get(slug)

export async function loadBody(slug: string): Promise<Body | undefined> {
  const hit = cache.get(slug)
  if (hit) return hit
  const load = loaders[`./posts/${slug}.mdx`]
  if (!load) return undefined
  const mod = await load()
  cache.set(slug, mod.default)
  return mod.default
}

/** Used by the server renderer (eager glob). */
export function registerBodies(mods: Record<string, { default: Body }>) {
  for (const [file, mod] of Object.entries(mods)) cache.set(file.replace(/^.*\/(.+)\.mdx$/, '$1'), mod.default)
}

/** Warm a post's chunk on hover / focus so the click feels instant. */
export function prefetchBody(slug: string) {
  if (!cache.has(slug)) loadBody(slug).catch(() => {})
}
