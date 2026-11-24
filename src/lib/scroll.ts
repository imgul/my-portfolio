import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { audio } from './audio'

gsap.registerPlugin(ScrollTrigger)

export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export let lenis: Lenis | null = null
export const scrollState = { velocity: 0, progress: 0 }

export function initScroll() {
  if (lenis || prefersReducedMotion) return
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, touchMultiplier: 1.4 })
  lenis.on('scroll', (l: Lenis) => {
    ScrollTrigger.update()
    scrollState.velocity = l.velocity
    scrollState.progress = l.progress
    audio.pushEnergy(Math.min(1, Math.abs(l.velocity) / 40))
  })
  gsap.ticker.add((time) => {
    scrollState.velocity *= 0.9
    lenis?.raf(time * 1000)
  })
  gsap.ticker.lagSmoothing(0)
  lenis.stop()
}

export function scrollTo(target: string | number | HTMLElement) {
  if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) })
  else if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' })
  else target.scrollIntoView({ behavior: 'smooth' })
}

if (typeof window !== 'undefined' && prefersReducedMotion) {
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight
    scrollState.progress = max > 0 ? scrollY / max : 0
  })
}
