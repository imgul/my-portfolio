import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { fx } from '../lib/feedback'
import { haptics } from '../lib/haptics'
import { journey } from '../data/content'

export default function Journey() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      const el = track.current!
      const distance = () => el.scrollWidth - window.innerWidth
      let lastCard = -1
      const tween = gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.journey__pin',
          start: 'top top',
          end: () => `+=${distance()}`,
          scrub: 0.8,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            gsap.set('.journey__runner', { scaleX: self.progress })
            const idx = Math.round(self.progress * (journey.length - 1))
            if (idx !== lastCard) {
              lastCard = idx
              fx.note(idx + 2)
              haptics.fire('tick')
              document.querySelectorAll('.chapter').forEach((c, i) => c.classList.toggle('is-current', i === idx))
            }
          },
        },
      })

      // Inner parallax: big years drift against the track.
      gsap.utils.toArray<HTMLElement>('.chapter__year').forEach((y) => {
        gsap.fromTo(
          y,
          { xPercent: 12 },
          {
            xPercent: -12,
            ease: 'none',
            scrollTrigger: { trigger: y, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
          },
        )
      })
    }, root)
    return () => ctx.revert()
  }, [entered])

  return (
    <section className="journey" ref={root} data-shape="2" data-index="2" id="journey">
      <div className="journey__pin">
        <div className="journey__track" ref={track}>
          <div className="journey__intro">
            <p className="eyebrow mono">
              <span>(02)</span> The Journey
            </p>
            <h2 className="display">
              Burewala
              <br />
              <em>to</em> the world.
            </h2>
            <p className="journey__lead">
              From a small-town kid teaching himself PHP on YouTube to a founder shipping AI products. Keep scrolling, it moves sideways.
            </p>
            <span className="journey__arrow mono">Scroll →</span>
          </div>
          {journey.map((c, i) => (
            <article className="chapter" key={i} onMouseEnter={fx.hover}>
              <span className="chapter__year" aria-hidden="true">
                {c.year}
              </span>
              <div className="chapter__card">
                <div className="chapter__head mono">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <span>{c.place}</span>
                </div>
                <h3>{c.title}</h3>
                <p className="chapter__org">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="link-u" data-cursor="Visit">
                      {c.org} ↗
                    </a>
                  ) : (
                    c.org
                  )}
                  <span className="mono"> · {c.period}</span>
                </p>
                <p className="chapter__body">{c.body}</p>
                <ul className="tags">
                  {c.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="journey__rail" aria-hidden="true">
          <span className="journey__runner" />
          {journey.map((c, i) => (
            <i key={i} style={{ left: `${(i / (journey.length - 1)) * 100}%` }}>
              <b className="mono">{c.year}</b>
            </i>
          ))}
        </div>
      </div>
    </section>
  )
}
