import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { audio } from '../lib/audio'
import { manifesto, stats } from '../data/content'

const HIGHLIGHT = new Set(['systems', 'businesses', 'SaaS', 'AI', 'agents', 'pays'])

export default function Manifesto() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>('.manifesto__text .w')
      let last = -1
      gsap.fromTo(
        words,
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.manifesto__pin',
            start: 'top top',
            end: '+=140%',
            scrub: 0.6,
            pin: true,
            onUpdate: (self) => {
              // A soft musical tick as each phrase lights up.
              const idx = Math.floor(self.progress * words.length)
              if (idx !== last && idx % 4 === 0 && self.getVelocity() > 0) audio.note(5 + ((idx / 4) % 8), 0.5)
              last = idx
            },
          },
        },
      )

      // Counters
      gsap.utils.toArray<HTMLElement>('.stat__value').forEach((el) => {
        const target = Number(el.dataset.value)
        const obj = { v: 0 }
        gsap.to(obj, {
          v: target,
          duration: 2,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onUpdate: () => (el.textContent = String(Math.round(obj.v))),
        })
      })
    }, root)
    return () => ctx.revert()
  }, [entered])

  return (
    <section className="manifesto" ref={root} data-shape="1" data-index="1">
      <div className="manifesto__pin">
        <p className="eyebrow mono">
          <span>(01)</span> Manifesto
        </p>
        <p className="manifesto__text">
          {manifesto.split(' ').map((w, i) => {
            const clean = w.replace(/[^\w]/g, '')
            return (
              <span key={i} className={`w ${HIGHLIGHT.has(clean) ? 'hl' : ''}`}>
                {w}{' '}
              </span>
            )
          })}
        </p>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.label} data-reveal>
            <div className="stat__num">
              <span className="stat__value" data-value={s.value}>
                0
              </span>
              <span className="stat__suffix">{s.suffix}</span>
            </div>
            <p className="stat__label mono">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
