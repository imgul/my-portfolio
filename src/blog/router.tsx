/**
 * A tiny client router for the blog (/blog, /blog/:slug, ?tag= / ?q= / ?category=)
 * and the legal pages it renders (/privacy, /terms, /cookies).
 * Links to the portfolio (/) are normal page loads: it is a separate app.
 * SSR-safe: during pre-rendering the location comes from setServerLocation().
 */
import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { LEGAL_PATHS } from './legal.mjs'

const isBrowser = typeof window !== 'undefined'
let serverHref = '/blog'
export const setServerLocation = (href: string) => {
  serverHref = href
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
if (isBrowser) window.addEventListener('popstate', emit)

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
const snapshot = () => (isBrowser ? window.location.pathname + window.location.search + window.location.hash : serverHref)
// during hydration the client must see the same URL the page was pre-rendered for
const serverSnapshot = () => (isBrowser ? window.location.pathname : serverHref)

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (to === snapshot()) return
  if (opts.replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  emit()
  if (!opts.keepScroll && !to.includes('#')) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const url = new URL(href, 'https://x.invalid')
  return { path: url.pathname.replace(/\/+$/, '') || '/', search: url.searchParams, hash: url.hash }
}

/** Scroll to #hash after navigation / first render. */
export function useHashScroll(dep: unknown) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id || id.startsWith(':~:')) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [dep])
}

const isInternal = (href: string) => href === '/blog' || href.startsWith('/blog/') || href.startsWith('/blog?') || href.startsWith('/blog#') || LEGAL_PATHS.includes(href.split(/[?#]/)[0])

export function Link({ href = '', onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!isInternal(href) || rest.target === '_blank' || href.endsWith('.md')) return
    e.preventDefault()
    navigate(href, { keepScroll: href.startsWith('/blog?') })
  }
  return <a href={href} onClick={handle} {...rest} />
}
