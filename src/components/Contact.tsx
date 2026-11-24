import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore, toast } from '../lib/store'
import { fx } from '../lib/feedback'
import { scrollTo } from '../lib/scroll'
import { sceneRef } from '../three/sceneRef'
import { useMagnetic } from '../lib/hooks'
import { profile } from '../data/content'

export default function Contact() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)
  const orb = useRef<HTMLButtonElement>(null)
  useMagnetic(orb, 0.5)

  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      gsap.from('.contact__title .ch', {
        yPercent: 120,
        rotate: 6,
        stagger: 0.025,
        duration: 1.3,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.contact__title', start: 'top 80%' },
      })
    }, root)
    return () => ctx.revert()
  }, [entered])

  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(profile.email)
      ok = true
    } catch {
      // Fallback for browsers without async clipboard permissions
      const ta = document.createElement('textarea')
      ta.value = profile.email
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      ta.remove()
    }
    toast(ok ? 'Email copied. Talk soon!' : profile.email)
    fx.success()
    sceneRef.current?.pulse(1)
    gsap.fromTo(orb.current, { scale: 0.88 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.35)' })
  }

  const words = ["Let's build", "what's next."]

  return (
    <section className="contact" ref={root} data-shape="6" data-index="9" id="contact">
      <p className="eyebrow mono">
        <span>(09)</span> Contact
      </p>
      <h2 className="contact__title" aria-label="Let's build what's next.">
        {words.map((w, wi) => (
          <span className="contact__line" key={wi} aria-hidden="true">
            {w.split('').map((c, i) => (
              <span className="mask" key={i}>
                <span className={`ch ${wi === 1 ? 'accent' : ''}`}>{c === ' ' ? '\u00A0' : c}</span>
              </span>
            ))}
          </span>
        ))}
      </h2>

      <div className="contact__grid">
        <button className="contact__orb" ref={orb} onClick={copy} onMouseEnter={fx.hover} data-cursor="Copy">
          <span className="contact__orb-text">
            Copy
            <br />
            email
          </span>
          <svg viewBox="0 0 200 200" className="contact__orb-ring" aria-hidden="true">
            <defs>
              <path id="circ" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" />
            </defs>
            <text>
              <textPath href="#circ" textLength="508" lengthAdjust="spacing">{`${profile.email} ✦ open to work ✦ `}</textPath>
            </text>
          </svg>
        </button>

        <div className="contact__info">
          <p className="contact__avail">
            <i className="pulse-dot" /> {profile.availability}
          </p>
          <p className="contact__lead">
            Hiring a senior engineer, looking for a technical co-founder, or need an AI-powered MVP shipped properly? My inbox is open.
          </p>
          <ul className="contact__links">
            {profile.socials.map((s) => (
              <li key={s.label}>
                <a href={s.url} target={s.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onMouseEnter={fx.hover} onClick={fx.click} data-cursor="Open">
                  <span className="mono">{s.label}</span>
                  <span className="contact__handle">{s.handle}</span>
                  <span className="contact__arrow">↗</span>
                </a>
              </li>
            ))}
            <li>
              <a href={profile.phoneHref} target="_blank" rel="noreferrer" onMouseEnter={fx.hover} onClick={fx.click} data-cursor="Chat">
                <span className="mono">WhatsApp</span>
                <span className="contact__handle">{profile.phone}</span>
                <span className="contact__arrow">↗</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <footer className="footer mono">
        <span>© {new Date().getFullYear()} Muhammad Gulzaib</span>
        <span className="footer__built">Three.js · GSAP · Web Audio · Vibration API. Press M for sound.</span>
        <button className="link-u" onClick={() => (fx.click(), scrollTo(0))} onMouseEnter={fx.hover} data-cursor="Up">
          Back to top ↑
        </button>
      </footer>
    </section>
  )
}
