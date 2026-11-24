import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { fx } from '../lib/feedback'
import { scrollState } from '../lib/scroll'
import { certifications, education, languages } from '../data/content'

/** Marquee whose speed + direction respond to scroll velocity. */
function Marquee({ reverse = false, children }: { reverse?: boolean; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = track.current!
    let x = 0
    let raf = 0
    let sign = 1
    const dir = reverse ? 1 : -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const half = el.scrollWidth / 2
      const v = scrollState.velocity
      if (Math.abs(v) > 0.5) sign = v < 0 ? -1 : 1
      x += dir * sign * (0.6 + Math.min(Math.abs(v), 60) * 0.3)
      if (x <= -half) x += half
      if (x > 0) x -= half
      el.style.transform = `translate3d(${x}px,0,0)`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [reverse])
  return (
    <div className="marquee">
      <div className="marquee__track" ref={track}>
        {children}
        {children}
      </div>
    </div>
  )
}

export default function Education() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)
  const half = Math.ceil(certifications.length / 2)

  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      gsap.from('.edu__roles li', {
        x: -40,
        opacity: 0,
        stagger: 0.07,
        duration: 1,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.edu__roles', start: 'top 85%' },
      })
    }, root)
    return () => ctx.revert()
  }, [entered])

  const cert = (c: (typeof certifications)[number]) => (
    <div className="cert" key={c.title} onMouseEnter={fx.hover}>
      <span className="cert__star">✦</span>
      <div>
        <p className="cert__title">{c.title}</p>
        <p className="cert__meta mono">
          {c.issuer} · {c.date}
        </p>
      </div>
    </div>
  )

  return (
    <section className="edu" ref={root} data-shape="0" data-index="7" id="learning">
      <header className="section-head">
        <p className="eyebrow mono">
          <span>(07)</span> Learning
        </p>
        <h2 className="display" data-reveal>
          Always a <em>student.</em>
        </h2>
      </header>

      <div className="edu__grid">
        <a className="edu__card" href={education.url} target="_blank" rel="noreferrer" data-reveal data-cursor="Visit" onMouseEnter={fx.hover}>
          <span className="mono edu__period">{education.period}</span>
          <h3>{education.degree}</h3>
          <p className="edu__school">{education.school} ↗</p>
          <span className="edu__grade">{education.grade}</span>
        </a>
        <div className="edu__side">
          <p className="mono label">Leadership on campus</p>
          <ul className="edu__roles">
            {education.roles.map((r) => (
              <li key={r} onMouseEnter={fx.hover}>
                <span>→</span> {r}
              </li>
            ))}
          </ul>
          <div className="edu__langs" data-reveal>
            {languages.map((l) => (
              <span className="chip chip--static" key={l.name}>
                {l.name} <em className="mono">{l.level}</em>
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mono label edu__certlabel">Certifications</p>
      <Marquee>{certifications.slice(0, half).map(cert)}</Marquee>
      <Marquee reverse>{certifications.slice(half).map(cert)}</Marquee>
    </section>
  )
}
