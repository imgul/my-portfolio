import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { audio } from '../lib/audio'
import { haptics } from '../lib/haptics'
import { lenis } from '../lib/scroll'
import { store } from '../lib/store'
import { sceneRef } from '../three/sceneRef'

export default function Loader() {
  const root = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(0)
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const counter = { v: 0 }
    const fonts = document.fonts?.ready ?? Promise.resolve()
    const tl = gsap.timeline()
    tl.to(counter, {
      v: 86,
      duration: 1.4,
      ease: 'power2.inOut',
      onUpdate: () => setPct(Math.round(counter.v)),
    })
    Promise.all([fonts, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      gsap.to(counter, {
        v: 100,
        duration: 0.5,
        ease: 'power2.out',
        onUpdate: () => setPct(Math.round(counter.v)),
        onComplete: () => setReady(true),
      })
    })
    gsap.from('.loader__name .ch', { yPercent: 110, stagger: 0.04, duration: 1.1, ease: 'expo.out', delay: 0.1 })
    return () => {
      tl.kill()
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    gsap.fromTo('.loader__actions > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.9, ease: 'expo.out' })
  }, [ready])

  const enter = async (withSound: boolean) => {
    // Must run inside the click gesture so audio + haptics are unlocked.
    audio.init()
    await audio.setMuted(!withSound)
    store.set({ sound: withSound })
    haptics.fire('heavy')
    if (withSound) audio.boot()
    sceneRef.current?.pulse(1.2)

    const tl = gsap.timeline({
      onComplete: () => {
        setGone(true)
        lenis?.start()
      },
    })
    tl.to('.loader__inner', { opacity: 0, y: -40, duration: 0.6, ease: 'power3.in' })
      .to('.loader__panel', { scaleY: 0, transformOrigin: 'top', duration: 1.1, stagger: 0.06, ease: 'expo.inOut' }, '-=0.2')
      .add(() => store.set({ entered: true }), '-=0.8')
  }

  if (gone) return null

  return (
    <div className="loader" ref={root} role="dialog" aria-label="Welcome">
      <div className="loader__panels" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span className="loader__panel" key={i} />
        ))}
      </div>
      <div className="loader__inner">
        <div className="loader__top mono">
          <span>Muhammad Gulzaib</span>
          <span>Portfolio, 2026 edition</span>
        </div>
        <div className="loader__name" role="img" aria-label="Gul">
          {'GUL'.split('').map((c, i) => (
            <span className="mask" key={i}>
              <span className="ch">{c}</span>
            </span>
          ))}
          <span className="loader__pct mono">{String(pct).padStart(3, '0')}%</span>
        </div>
        <div className="loader__bar">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className="loader__bottom">
          <p className="loader__note">
            This site is built to be <em>felt</em>. It has generative music, sound and haptics.
            <br />
            Headphones recommended.
          </p>
          <div className="loader__actions" style={{ visibility: ready ? 'visible' : 'hidden' }}>
            <button className="btn btn--primary" onClick={() => enter(true)} data-cursor="Enter">
              <span className="eq" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              Enter with sound
            </button>
            <button className="btn btn--ghost" onClick={() => enter(false)} data-cursor="Enter">
              Enter in silence
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
