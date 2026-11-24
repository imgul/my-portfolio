import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ParticleField } from './three/ParticleField'
import { sceneRef } from './three/sceneRef'
import { initScroll, prefersReducedMotion } from './lib/scroll'
import { store, useStore } from './lib/store'
import { audio } from './lib/audio'
import { fx } from './lib/feedback'
import Loader from './components/Loader'
import Cursor from './components/Cursor'
import HUD from './components/HUD'
import Hero from './components/Hero'
import Manifesto from './components/Manifesto'
import Journey from './components/Journey'
import Ventures from './components/Ventures'
import Lessons from './components/Lessons'
import Stack from './components/Stack'
import Agents from './components/Agents'
import Education from './components/Education'
import Beyond from './components/Beyond'
import Contact from './components/Contact'
import Toast from './components/Toast'


export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const entered = useStore((s) => s.entered)

  // 3D scene + smooth scroll
  useEffect(() => {
    initScroll()
    let field: ParticleField | null = null
    try {
      field = new ParticleField(canvas.current!)
      sceneRef.current = field
    } catch (e) {
      console.warn('WebGL unavailable, continuing without 3D', e)
    }
    return () => {
      field?.dispose()
      sceneRef.current = null
    }
  }, [])

  // Section → 3D shape + HUD + sound
  useEffect(() => {
    if (!entered) return
    const triggers: ScrollTrigger[] = []
    document.querySelectorAll<HTMLElement>('[data-shape]').forEach((el) => {
      const shape = Number(el.dataset.shape)
      const index = Number(el.dataset.index)
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (!self.isActive) return
            sceneRef.current?.setShape(shape)
            if (store.get().section !== index) {
              store.set({ section: index })
              if (index > 0) fx.section()
            }
          },
        }),
      )
    })

    // Generic reveal for [data-reveal] elements
    const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]')
    reveals.forEach((el) => gsap.set(el, { y: 40, opacity: 0 }))
    const batch = ScrollTrigger.batch(reveals, {
      start: 'top 88%',
      onEnter: (els) =>
        gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    })
    triggers.push(...batch)

    requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => triggers.forEach((t) => t.kill())
  }, [entered])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!store.get().entered || e.metaKey || e.ctrlKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key.toLowerCase() === 'm') {
        const next = !store.get().sound
        store.set({ sound: next })
        audio.setMuted(!next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <canvas ref={canvas} className="gl" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {!prefersReducedMotion && <Cursor />}
      <Loader />
      <HUD />
      <main className={entered ? 'is-entered' : ''}>
        <Hero />
        <Manifesto />
        <Journey />
        <Ventures />
        <Lessons />
        <Stack />
        <Agents />
        <Education />
        <Beyond />
        <Contact />
      </main>
      <Toast />
    </>
  )
}
