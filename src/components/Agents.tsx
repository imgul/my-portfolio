import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStore } from '../lib/store'
import { audio } from '../lib/audio'
import { fx } from '../lib/feedback'
import { agents } from '../data/content'

const R = 38 // radius in % of the diagram

export default function Agents() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [lines, setLines] = useState<string[]>([])
  const [auto, setAuto] = useState(true)
  const inView = useRef(false)

  const pos = (i: number) => {
    const a = (i / agents.length) * Math.PI * 2 - Math.PI / 2
    return { x: 50 + Math.cos(a) * R, y: 50 + Math.sin(a) * R }
  }

  // Typewriter terminal log for the active agent
  useEffect(() => {
    const log = agents[active].log
    setLines([])
    let li = 0
    let ci = 0
    let buf: string[] = []
    const id = setInterval(() => {
      if (li >= log.length) return clearInterval(id)
      const line = log[li]
      ci += 2
      buf = [...buf.slice(0, li), line.slice(0, ci)]
      setLines(buf)
      if (inView.current && ci % 6 === 0) audio.hover()
      if (ci >= line.length) {
        li++
        ci = 0
      }
    }, 28)
    return () => clearInterval(id)
  }, [active])

  // Auto-cycle while visible until the user takes over
  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => inView.current && setActive((a) => (a + 1) % agents.length), 4200)
    return () => clearInterval(id)
  }, [auto])

  useEffect(() => {
    if (!entered) return
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: 'top 60%',
      end: 'bottom 40%',
      onToggle: (s) => (inView.current = s.isActive),
    })
    const ctx = gsap.context(() => {
      gsap.from('.agent-node', {
        scale: 0,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: 'back.out(2)',
        scrollTrigger: { trigger: '.agents__diagram', start: 'top 75%' },
      })
      gsap.from('.agents__diagram line', {
        attr: { x2: 50, y2: 50 },
        duration: 1.2,
        stagger: 0.06,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.agents__diagram', start: 'top 75%' },
      })
    }, root)
    return () => {
      st.kill()
      ctx.revert()
    }
  }, [entered])

  const pick = (i: number) => {
    setAuto(false)
    setActive(i)
    fx.click()
  }

  return (
    <section className="agents" ref={root} data-shape="6" data-index="6" id="agents">
      <header className="section-head">
        <p className="eyebrow mono">
          <span>(06)</span> AI systems
        </p>
        <h2 className="display" data-reveal>
          The AI-native <em>company.</em>
        </h2>
        <p className="section-lead" data-reveal>
          I build RAG pipelines and AI APIs in Flask and Laravel. The bigger goal is an orchestrator that coordinates specialised agents which do real work, with a human in the loop. Tap an agent to see it work.
        </p>
      </header>

      <div className="agents__wrap">
        <div className="agents__diagram">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <circle cx="50" cy="50" r={R} className="orbit" />
            {agents.map((a, i) => {
              const p = pos(i)
              return (
                <g key={a.id} className={i === active ? 'is-active' : ''}>
                  <line x1="50" y1="50" x2={p.x} y2={p.y} />
                  <circle r="0.9" className="packet">
                    <animateMotion dur={`${1.6 + i * 0.2}s`} repeatCount="indefinite" path={`M50,50 L${p.x},${p.y}`} />
                  </circle>
                </g>
              )
            })}
          </svg>
          <div className="agent-core">
            <span className="mono">Orchestrator</span>
            <strong>GUL-OS</strong>
          </div>
          {agents.map((a, i) => {
            const p = pos(i)
            return (
              <button
                key={a.id}
                className={`agent-node ${i === active ? 'is-active' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={() => pick(i)}
                onMouseEnter={() => fx.note(i + 3)}
                data-cursor="Run"
              >
                <span className="agent-node__name">{a.name}</span>
                <span className="agent-node__role mono">{a.role}</span>
              </button>
            )
          })}
        </div>

        <div className="terminal" role="log" aria-live="polite">
          <div className="terminal__bar">
            <i />
            <i />
            <i />
            <span className="mono">agent://{agents[active].id}</span>
          </div>
          <div className="terminal__body mono">
            {lines.map((l, i) => (
              <p key={i} className={l.startsWith('✓') ? 'ok' : ''}>
                {l}
              </p>
            ))}
            <span className="caret" />
          </div>
          <div className="terminal__foot mono">
            <span>RAG</span>
            <span>Tool use</span>
            <span>Memory</span>
            <span>Human-in-the-loop</span>
          </div>
        </div>
      </div>
    </section>
  )
}
