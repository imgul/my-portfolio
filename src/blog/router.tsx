/**
 * A tiny client router for the blog (/blog, /blog/:slug, ?tag= / ?q= / ?category=).
 * Links to the portfolio (/) are normal page loads: it is a separate app.
 */
import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
window.addEventListener('popstate', emit)

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
const snapshot = () => window.location.pathname + window.location.search + window.location.hash

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (to === snapshot()) return
  if (opts.replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  emit()
  if (!opts.keepScroll && !to.includes('#')) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot)
  const url = new URL(href, window.location.origin)
  return { path: url.pathname.replace(/\/+$/, '') || '/', search: url.searchParams, hash: url.hash }
}

/** Scroll to #hash after navigation / first render. */
export function useHashScroll(dep: unknown) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60)
    return () => clearTimeout(t)
  }, [dep])
}

const isInternal = (href: string) => href.startsWith('/blog')

export function Link({ href = '', onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!isInternal(href) || rest.target === '_blank') return
    e.preventDefault()
    navigate(href, { keepScroll: href.startsWith('/blog?') })
  }
  return <a href={href} onClick={handle} {...rest} />
}
