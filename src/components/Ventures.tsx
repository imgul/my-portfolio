import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { fx } from '../lib/feedback'
import { useTilt } from '../lib/hooks'
import { ventures, type Venture } from '../data/content'

function Card({ v, i }: { v: Venture; i: number }) {
  const inner = useRef<HTMLDivElement>(null)
  useTilt(inner, 4)
  return (
    <article
      className="venture"
      style={{ ['--h1' as string]: v.hue, ['--h2' as string]: v.hue2, top: `calc(9vh + ${i * 14}px)` }}
      onMouseEnter={() => fx.note(i * 2)}
    >
      <div className="venture__inner" ref={inner}>
        <div className="venture__glare" aria-hidden="true" />
        <div className="venture__content">
          <div className="venture__head mono">
            <span>{v.kicker}</span>
            <span className="badge">
              <i className="pulse-dot" /> {v.status}
            </span>
          </div>
          <h3 className="venture__name">{v.name}</h3>
          <p className="venture__tagline">{v.tagline}</p>
          <p className="venture__body">{v.body}</p>
          <ul className="venture__points">
            {v.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="venture__foot">
            <span className="mono role">{v.role}</span>
            {v.url && (
              <a className="btn btn--small btn--ghost" href={v.url} target="_blank" rel="noreferrer" onClick={fx.click} data-cursor="Visit">
                {v.url.replace('https://', '')} ↗
              </a>
            )}
          </div>
        </div>
        <div className="venture__visual" aria-hidden="true">
          <div className="orb">
            <span className="orb__ring" />
            <span className="orb__ring orb__ring--2" />
            <span className="orb__core" />
            <span className="orb__grid" />
          </div>
          <span className="venture__index">{String(i + 1).padStart(2, '0')}</span>
        </div>
      </div>
    </article>
  )
}

export default function Ventures() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.venture')
      cards.forEach((card, i) => {
        const next = cards[i + 1]
        if (!next) return
        gsap.fromTo(card.querySelector('.venture__inner'), { scale: 1, filter: 'brightness(1)' }, {
          scale: 0.92,
          filter: 'brightness(0.55)',
          ease: 'none',
          scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 15%', scrub: true },
        })
      })
      gsap.from('.ventures__title .ch', {
        yPercent: 110,
        stagger: 0.03,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.ventures__title', start: 'top 80%' },
      })
    }, root)
    return () => ctx.revert()
  }, [entered])

  return (
    <section className="ventures" ref={root} data-shape="3" data-index="3" id="ventures">
      <header className="section-head">
        <p className="eyebrow mono">
          <span>(03)</span> Ventures &amp; products
        </p>
        <h2 className="display ventures__title" aria-label="Things I'm building">
          {"Things I'm".split('').map((c, i) => (
            <span className="mask" key={i}>
              <span className="ch">{c === ' ' ? '\u00A0' : c}</span>
            </span>
          ))}
          <br />
          {'building.'.split('').map((c, i) => (
            <span className="mask" key={'b' + i}>
              <span className="ch accent">{c}</span>
            </span>
          ))}
        </h2>
        <p className="section-lead" data-reveal>
          A company, a few products and some honest R&amp;D. I treat every one of them as a business, not a side project.
        </p>
      </header>
      <div className="ventures__stack">
        {ventures.map((v, i) => (
          <Card v={v} i={i} key={v.name} />
        ))}
      </div>
    </section>
  )
}
