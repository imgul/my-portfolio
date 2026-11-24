import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useStore, store } from '../lib/store'
import { audio } from '../lib/audio'
import { haptics } from '../lib/haptics'
import { fx } from '../lib/feedback'
import { scrollState, scrollTo } from '../lib/scroll'
import { profile, SECTIONS } from '../data/content'
import { useClock, useMagnetic } from '../lib/hooks'

export default function HUD() {
  const entered = useStore((s) => s.entered)
  const sound = useStore((s) => s.sound)
  const hapticsOn = useStore((s) => s.haptics)
  const section = useStore((s) => s.section)
  const bar = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const talk = useRef<HTMLButtonElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const time = useClock(profile.timezone)
  useMagnetic(talk, 0.3)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (bar.current) bar.current.style.transform = `scaleY(${scrollState.progress})`
      if (!scrolled && scrollState.progress > 0.01) setScrolled(true)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [scrolled])

  useEffect(() => {
    if (!entered) return
    gsap.fromTo(
      root.current!.querySelectorAll('.hud__item'),
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, stagger: 0.06, ease: 'expo.out', delay: 0.6 },
    )
  }, [entered])

  const toggleSound = () => {
    const next = !sound
    store.set({ sound: next })
    audio.setMuted(!next).then(() => next && audio.click())
    haptics.fire('click')
  }
  const toggleHaptics = () => {
    const next = !hapticsOn
    haptics.setEnabled(next)
    store.set({ haptics: next })
    if (next) haptics.fire('success')
    audio.click()
  }

  const go = (i: number) => {
    const el = document.querySelector<HTMLElement>(`[data-index="${i}"]`)
    if (el) scrollTo(el)
    setMenu(false)
    fx.click()
  }

  return (
    <div className={`hud ${entered ? 'is-on' : ''} ${menu ? 'menu-open' : ''}`} ref={root}>
      <header className="hud__top">
        <button className="hud__item hud__logo" onClick={() => go(0)} onMouseEnter={fx.hover} data-cursor="Top">
          <span className="logo-mark" aria-hidden="true" />
          GUL<sup>©</sup>
        </button>

        <div className="hud__item hud__section mono" aria-live="polite">
          <span className="hud__num">{String(section + 1).padStart(2, '0')}</span>
          <span className="hud__sep">/</span>
          <span className="hud__roll">
            <span key={section} className="hud__label">
              {SECTIONS[section]}
            </span>
          </span>
        </div>

        <div className="hud__right">
          <button
            className={`hud__item chip ${sound ? 'is-active' : ''}`}
            onClick={toggleSound}
            onMouseEnter={fx.hover}
            aria-pressed={sound}
            data-cursor={sound ? 'Mute' : 'Play'}
            title="Toggle sound (M)"
          >
            <span className={`eq ${sound ? 'is-playing' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="chip__text">{sound ? 'Sound on' : 'Sound off'}</span>
          </button>
          {haptics.supported() && (
            <button
              className={`hud__item chip ${hapticsOn ? 'is-active' : ''}`}
              onClick={toggleHaptics}
              aria-pressed={hapticsOn}
              title="Toggle haptics"
            >
              <span className="vib" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="8" y="3" width="8" height="18" rx="2" />
                  <path d="M4 8v8M20 8v8M1 10v4M23 10v4" />
                </svg>
              </span>
              <span className="chip__text">{hapticsOn ? 'Haptics' : 'No haptics'}</span>
            </button>
          )}
          <button className="hud__item btn btn--small btn--primary hud__talk" ref={talk} onClick={() => go(SECTIONS.length - 1)} onMouseEnter={fx.hover} data-cursor="Hi!">
            Let’s talk
          </button>
          <button className="hud__item hud__burger" onClick={() => (setMenu(!menu), fx.click())} aria-label="Menu" aria-expanded={menu}>
            <i />
            <i />
          </button>
        </div>
      </header>

      <nav className="hud__dots" aria-label="Sections">
        {SECTIONS.map((s, i) => (
          <button key={s} className={`hud__dot ${i === section ? 'is-active' : ''}`} onClick={() => go(i)} onMouseEnter={fx.hover} aria-label={s}>
            <span className="mono">{s}</span>
          </button>
        ))}
      </nav>

      <div className="hud__progress" aria-hidden="true">
        <div ref={bar} />
      </div>

      <div className="hud__item hud__clock mono">
        <span className="pulse-dot" /> Islamabad · {time} PKT
      </div>
      <div className={`hud__item hud__hint mono ${scrolled ? 'is-hidden' : ''}`}>
        Scroll to explore <span className="hint-line" />
      </div>

      <div className="menu" aria-hidden={!menu}>
        <ul>
          {SECTIONS.map((s, i) => (
            <li key={s} style={{ transitionDelay: `${menu ? i * 0.04 : 0}s` }}>
              <button onClick={() => go(i)} onMouseEnter={fx.hover}>
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
