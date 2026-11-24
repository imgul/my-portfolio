import { useRef } from 'react'
import { fx } from '../lib/feedback'
import { beyond, profile } from '../data/content'
import { useClock } from '../lib/hooks'

export default function Beyond() {
  const grid = useRef<HTMLDivElement>(null)
  const time = useClock(profile.timezone)

  // Spotlight that follows the pointer across every card at once.
  const onMove = (e: React.PointerEvent) => {
    grid.current?.querySelectorAll<HTMLElement>('.interest').forEach((c) => {
      const r = c.getBoundingClientRect()
      c.style.setProperty('--x', `${e.clientX - r.left}px`)
      c.style.setProperty('--y', `${e.clientY - r.top}px`)
    })
  }

  return (
    <section className="beyond" data-shape="8" data-index="8" id="beyond">
      <header className="section-head">
        <p className="eyebrow mono">
          <span>(08)</span> Beyond the code
        </p>
        <h2 className="display" data-reveal>
          Mountains, motorcycles <em>&amp;</em> machines that think.
        </h2>
        <p className="section-lead" data-reveal>
          Right now it’s <span className="mono accent">{time}</span> in Islamabad. When I’m not shipping I’m usually on a Margalla trail or planning the next ride north.
        </p>
      </header>
      <div className="interests" ref={grid} onPointerMove={onMove}>
        {beyond.map((b, i) => (
          <article className="interest" key={b.title} data-reveal onMouseEnter={() => fx.note(i + 4)}>
            <span className="interest__glyph">{b.glyph}</span>
            <h3>{b.title}</h3>
            <p>{b.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
