import { useEffect, useRef } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStore, store } from '../lib/store'
import { audio } from '../lib/audio'
import { fx } from '../lib/feedback'
import { stack } from '../data/content'

/** Every skill is a key on a pentatonic synth. Run your cursor (or finger) across them. */
export default function Stack() {
  const entered = useStore((s) => s.entered)
  const sound = useStore((s) => s.sound)
  const root = useRef<HTMLElement>(null)
  const lastKey = useRef<HTMLElement | null>(null)

  const strike = (el: HTMLElement) => {
    if (lastKey.current === el) return
    lastKey.current = el
    const note = Number(el.dataset.note)
    fx.note(note)
    el.classList.remove('is-struck')
    void el.offsetWidth
    el.classList.add('is-struck')
  }

  // Touch: slide a finger across the keys like a real instrument.
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0]
    const el = document.elementFromPoint(t.clientX, t.clientY)?.closest<HTMLElement>('.key')
    if (el) strike(el)
  }

  useEffect(() => {
    if (!entered) return
    const board = root.current!.querySelector<HTMLElement>('.stack__board')!
    let done: number | undefined
    const st = ScrollTrigger.create({
      trigger: board,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        board.classList.add('is-in')
        done = window.setTimeout(() => board.classList.add('is-done'), 1600)
      },
    })
    return () => {
      st.kill()
      clearTimeout(done)
    }
  }, [entered])

  return (
    <section className="stack" ref={root} data-shape="4" data-index="5" id="stack">
      <header className="section-head">
        <p className="eyebrow mono">
          <span>(05)</span> Stack
        </p>
        <h2 className="display" data-reveal>
          Play my <em>stack.</em>
        </h2>
        <p className="section-lead" data-reveal>
          Each skill is a key on a pentatonic synth, and brighter dots mean deeper experience. Run your cursor or finger across the board.
        </p>
        {!sound && (
          <button
            className="btn btn--small btn--primary"
            data-reveal
            onClick={() => {
              store.set({ sound: true })
              audio.setMuted(false).then(() => audio.success())
            }}
          >
            ♪ Turn sound on to play
          </button>
        )}
      </header>

      <div className="stack__board" onTouchMove={onTouchMove} onPointerLeave={() => (lastKey.current = null)}>
        {stack.map((g, gi) => (
          <div className="stack__row" key={g.group}>
            <span className="stack__group mono">
              {String(gi + 1).padStart(2, '0')} · {g.group}
            </span>
            <div className="stack__keys">
              {g.skills.map((s, si) => {
                const note = gi + si + 1
                return (
                  <button
                    key={s.name}
                    className="key"
                    data-note={note}
                    data-cursor="♪"
                    onPointerEnter={(e) => strike(e.currentTarget)}
                    onPointerDown={(e) => {
                      lastKey.current = null
                      strike(e.currentTarget)
                    }}
                    style={{ ['--d' as string]: ((gi * 3 + si * 7) % 11) * 0.04 }}
                  >
                    <span className="key__name">{s.name}</span>
                    <span className="key__lvl" aria-label={`${s.level} of 5`}>
                      {Array.from({ length: 5 }).map((_, k) => (
                        <i key={k} className={k < s.level ? 'on' : ''} />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
