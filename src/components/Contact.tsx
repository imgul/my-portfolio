import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { fx } from '../lib/feedback'
import { scrollTo } from '../lib/scroll'
import { profile } from '../data/content'
import HoldToCopy from './HoldToCopy'

export default function Contact() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)

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

  const words = ["Let's build", "what's next."]

  return (
    <section className="contact" ref={root} data-shape="9" data-index="9" id="contact">
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
        <HoldToCopy email={profile.email} ringText={`${profile.email} ✦ open to work ✦ `} />

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
