import { useEffect, type RefObject } from 'react'
import { useConsent, optionalAllowed } from '../lib/consent/consent'
import { readFraction } from './reading-progress'
import { ReadingEngagement } from './reading-engagement'
import { openResetChannel, recordReadingOutcome, RECOMMENDATION_RESET } from './recommendation-history'
import { RECOMMENDATION_KEY } from './recommendation-data'

/** Collect only while opted in; raw pointer, keyboard and timing events never leave memory. */
export function useReadingEngagement(slug: string | undefined, minutes: number | undefined, article: RefObject<HTMLElement | null>, end: RefObject<HTMLElement | null>, ready: boolean) {
  const consent = useConsent()
  useEffect(() => {
    if (!ready || !slug || consent?.choice !== 'all') return
    let session = new ReadingEngagement()
    let finished = false
    let lastPointer = 0
    let recorded = ''
    const measure = () => {
      const a = article.current
      const e = end.current
      const start = a ? a.getBoundingClientRect().top + window.scrollY : 0
      const finish = e ? e.getBoundingClientRect().top + window.scrollY : 0
      const eligible = !!a && !!e && document.visibilityState === 'visible' && document.hasFocus() && optionalAllowed() && start < window.scrollY + window.innerHeight && finish > window.scrollY
      return { eligible, depth: eligible ? readFraction(start, finish, window.innerHeight, window.scrollY) : 0 }
    }
    const sample = () => {
      const { eligible, depth } = measure()
      session.sample(performance.now(), eligible, depth)
      if (!eligible) session.pause()
    }
    const flush = (final = false) => {
      sample()
      const result = session.outcome(minutes ?? 5, final)
      if (result && optionalAllowed()) {
        const key = `${result.kind}:${result.strength}`
        if (key !== recorded) {
          recordReadingOutcome(slug, result)
          recorded = key
        }
      }
    }
    const input = (event: Event) => {
      if (!event.isTrusted) return
      if (event instanceof KeyboardEvent) {
        if (event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return
        if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'j', 'k'].includes(event.key)) return
      } else if (!article.current?.contains(event.target as Node)) return
      if (event instanceof PointerEvent) {
        const now = performance.now()
        if (now - lastPointer < 250) return
        lastPointer = now
      }
      const { eligible, depth } = measure()
      session.input(performance.now(), eligible, depth)
    }
    const pause = () => { sample(); session.pause() }
    const finish = () => {
      if (finished) return
      finished = true
      flush(true)
    }
    const reset = () => { session = new ReadingEngagement(); recorded = '' }
    const channel = openResetChannel()
    if (channel) channel.onmessage = (event) => { if (event.data === 'reset') reset() }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) { reset(); finished = false }
    }
    const onStorage = (e: StorageEvent) => { if ((e.key === RECOMMENDATION_KEY && e.newValue === null) || e.key === null) reset() }
    const timer = window.setInterval(() => flush(), 1000)
    window.addEventListener('pointermove', input, { passive: true })
    window.addEventListener('pointerdown', input, { passive: true })
    window.addEventListener('wheel', input, { passive: true })
    window.addEventListener('touchstart', input, { passive: true })
    window.addEventListener('touchmove', input, { passive: true })
    window.addEventListener('keydown', input)
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', pause)
    window.addEventListener('pagehide', finish)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener(RECOMMENDATION_RESET, reset)
    window.addEventListener('storage', onStorage)
    return () => {
      window.clearInterval(timer)
      channel?.close()
      finish()
      window.removeEventListener('pointermove', input)
      window.removeEventListener('pointerdown', input)
      window.removeEventListener('wheel', input)
      window.removeEventListener('touchstart', input)
      window.removeEventListener('touchmove', input)
      window.removeEventListener('keydown', input)
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', pause)
      window.removeEventListener('pagehide', finish)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener(RECOMMENDATION_RESET, reset)
      window.removeEventListener('storage', onStorage)
    }
  }, [slug, minutes, article, end, ready, consent?.choice])
}
