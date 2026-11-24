import { useEffect, useState, type RefObject } from 'react'
import { gsap } from 'gsap'

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Element is pulled toward the cursor while hovered. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.35) {
  useEffect(() => {
    const el = ref.current
    if (!el || !finePointer()) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * strength)
      yTo((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => {
      xTo(0)
      yTo(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ref, strength])
}

/** 3D tilt + a glare position written to CSS vars --mx / --my. */
export function useTilt(ref: RefObject<HTMLElement | null>, max = 8) {
  useEffect(() => {
    const el = ref.current
    if (!el || !finePointer()) return
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' })
    gsap.set(el, { transformPerspective: 1200 })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      ry((px - 0.5) * max * 2)
      rx(-(py - 0.5) * max * 2)
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
    }
    const leave = () => {
      rx(0)
      ry(0)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ref, max])
}

/** Live clock for a given IANA timezone. */
export function useClock(timeZone: string) {
  const fmt = () =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone, hour12: false }).format(new Date())
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeZone])
  return time
}
