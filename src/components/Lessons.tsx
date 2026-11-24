import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { fx } from '../lib/feedback'
import { lessons } from '../data/content'

export default function Lessons() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.lesson').forEach((el) => {
        gsap.fromTo(
          el.querySelector('.lesson__line'),
          { scaleX: 0 },
          { scaleX: 1, ease: 'expo.out', duration: 1.6, scrollTrigger: { trigger: el, start: 'top 85%' } },
        )
        gsap.from(el.querySelectorAll('.lesson__n, h3, p'), {
          y: 50,
          opacity: 0,
          stagger: 0.08,
          duration: 1.2,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [entered])

  return (
    <section className="lessons" ref={root} data-shape="3" data-index="4">
      <header className="section-head">
        <p className="eyebrow mono">
          <span>(04)</span> Founder notes
        </p>
        <h2 className="display" data-reveal>
          Lessons that <em>cost</em> me something.
        </h2>
      </header>
      <div className="lessons__list">
        {lessons.map((l) => (
          <article className="lesson" key={l.n} onMouseEnter={fx.hover}>
            <span className="lesson__line" />
            <span className="lesson__n mono">{l.n}</span>
            <h3>{l.title}</h3>
            <p>{l.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
