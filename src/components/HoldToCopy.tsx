import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import { audio } from '../lib/audio'
import { haptics } from '../lib/haptics'
import { toast } from '../lib/store'
import { fx } from '../lib/feedback'
import { useMagnetic } from '../lib/hooks'
import { sceneRef } from '../three/sceneRef'

/**
 * Press-and-hold "copy email" orb.
 * Hold → liquid fills, ring charges, sparks get sucked in, the orb trembles,
 * a synth charges up through an ascending scale with haptic ticks.
 * Full → flash, shockwaves, confetti, sub boom + sparkle, big haptic pattern.
 * Let go early → it drains and powers down. Quick tap → "hold it" hint.
 * Keyboard: hold Space / Enter. Assistive-tech clicks copy instantly.
 */

const HOLD_MS = 1200
const TICKS = 12
const R = 96
const CIRC = 2 * Math.PI * R
const COLORS = ['#c6ff3d', '#c6ff3d', '#5b8cff', '#c46bff', '#ecebe6']
const GLYPHS = ['✦', '@', '✓', '+']
const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  a: i * 18 + Math.random() * 12,
  d: -Math.random() * 0.7,
  r: 150 + Math.random() * 70,
  streak: i % 3 === 0,
}))

type Phase = 'idle' | 'holding' | 'done' | 'hint'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function HoldToCopy({ email, ringText }: { email: string; ringText: string }) {
  const btn = useRef<HTMLButtonElement>(null)
  const bar = useRef<SVGCircleElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const ring = useRef<HTMLSpanElement>(null)
  const burst = useRef<HTMLSpanElement>(null)
  const shocks = useRef<HTMLSpanElement>(null)
  const flash = useRef<HTMLSpanElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const s = useRef({
    p: 0,
    holding: false,
    done: false,
    start: 0,
    raf: 0,
    ticks: 0,
    pendingCopy: false,
    timer: 0,
    drain: null as gsap.core.Tween | null,
    spin: null as gsap.core.Tween | null,
  })
  useMagnetic(btn, 0.3)

  /** Write progress into CSS vars / SVG. */
  const render = (p: number) => {
    const el = btn.current
    if (!el) return
    el.style.setProperty('--p', p.toFixed(4))
    if (bar.current) bar.current.style.strokeDashoffset = String(CIRC * (1 - p))
    if (pct.current) pct.current.textContent = String(Math.round(p * 100))
    s.current.spin?.timeScale(1 + p * 14)
  }

  const jitter = (amp: number) => {
    const el = btn.current
    if (!el) return
    el.style.setProperty('--sx', `${((Math.random() - 0.5) * amp).toFixed(2)}px`)
    el.style.setProperty('--sy', `${((Math.random() - 0.5) * amp).toFixed(2)}px`)
  }

  useEffect(() => {
    const st = s.current
    st.spin = gsap.to(ring.current, { rotation: 360, duration: 18, repeat: -1, ease: 'none' })
    return () => {
      st.spin?.kill()
      st.drain?.kill()
      cancelAnimationFrame(st.raf)
      window.clearTimeout(st.timer)
      sceneRef.current?.charge(0)
    }
  }, [])

  const loop = () => {
    const st = s.current
    if (!st.holding) return
    const p = Math.min(1, (performance.now() - st.start) / HOLD_MS)
    st.p = p
    render(p)
    audio.chargeSet(p)
    sceneRef.current?.charge(p)
    jitter(reduced() ? 0 : p * p * 6)
    const tick = Math.min(Math.floor(p * TICKS), TICKS - 1)
    while (st.ticks < tick) {
      st.ticks++
      audio.chargeTick(st.ticks)
      haptics.buzz(Math.round(5 + (st.ticks / TICKS) * 24))
    }
    if (p >= 1) {
      complete()
      return
    }
    st.raf = requestAnimationFrame(loop)
  }

  const start = () => {
    const st = s.current
    if (st.holding || st.done) return
    st.drain?.kill()
    window.clearTimeout(st.timer)
    st.holding = true
    // resume from wherever the drain had got to
    st.start = performance.now() - st.p * HOLD_MS
    st.ticks = Math.floor(st.p * TICKS)
    setPhase('holding')
    audio.chargeStart()
    audio.chargeTick(st.ticks)
    haptics.buzz(6)
    st.raf = requestAnimationFrame(loop)
  }

  const end = () => {
    const st = s.current
    if (st.pendingCopy) {
      // Some browsers (Safari, touch) only allow clipboard writes inside the release gesture.
      st.pendingCopy = false
      copyText(email).then((ok) => toast(ok ? 'Email copied. Talk soon! ✦' : email))
    }
    if (!st.holding) return
    st.holding = false
    cancelAnimationFrame(st.raf)
    const quick = performance.now() - st.start < 240 && st.p < 0.25
    audio.chargeCancel()
    haptics.buzz(0)
    jitter(0)
    st.drain = gsap.to(st, {
      p: 0,
      duration: 0.35 + st.p * 0.5,
      ease: 'power3.out',
      onUpdate: () => {
        render(st.p)
        sceneRef.current?.charge(st.p)
      },
    })
    if (quick) {
      setPhase('hint')
      haptics.buzz([8, 70, 8])
      if (!reduced()) gsap.fromTo(btn.current, { rotation: -7 }, { rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.25)' })
      st.timer = window.setTimeout(() => setPhase('idle'), 1500)
    } else {
      setPhase('idle')
    }
  }

  const celebrate = () => {
    const el = btn.current!
    gsap.fromTo(el, { scale: 1.16 }, { scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.3)' })
    gsap.fromTo(flash.current, { opacity: 0.95 }, { opacity: 0, duration: 0.8, ease: 'power2.out' })
    Array.from(shocks.current!.children).forEach((c, i) =>
      gsap.fromTo(c, { scale: 1, opacity: 0.9 }, { scale: 2.3 + i * 0.55, opacity: 0, duration: 1.1 + i * 0.25, delay: i * 0.08, ease: 'expo.out' }),
    )
    if (reduced()) return
    const grid = el.closest('.contact__grid')
    if (grid) gsap.fromTo(grid, { x: -8 }, { x: 0, duration: 0.7, ease: 'elastic.out(1.4, 0.18)', clearProps: 'x' })

    const host = burst.current!
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i')
      const kind = Math.random()
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      if (kind < 0.22) {
        p.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        p.style.cssText = `color:${color};font-size:${14 + Math.random() * 16}px`
      } else if (kind < 0.5) {
        p.style.cssText = `background:${color};width:${10 + Math.random() * 14}px;height:3px;border-radius:2px`
      } else if (kind < 0.75) {
        const sz = 5 + Math.random() * 7
        p.style.cssText = `background:${color};width:${sz}px;height:${sz}px;border-radius:50%`
      } else {
        const sz = 6 + Math.random() * 6
        p.style.cssText = `background:${color};width:${sz}px;height:${sz}px;border-radius:2px`
      }
      host.appendChild(p)
      const a = Math.random() * Math.PI * 2
      const d = 120 + Math.random() * 240
      gsap.set(p, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: (a * 180) / Math.PI, scale: 0.4 })
      gsap
        .timeline({ onComplete: () => p.remove() })
        .to(p, { x: Math.cos(a) * d, y: Math.sin(a) * d - 30, scale: 1, rotation: `+=${gsap.utils.random(-260, 260)}`, duration: 0.75 + Math.random() * 0.4, ease: 'expo.out' })
        .to(p, { y: `+=${70 + Math.random() * 110}`, opacity: 0, scale: 0.2, duration: 0.7 + Math.random() * 0.5, ease: 'power1.in' }, '-=0.2')
    }
  }

  const complete = async () => {
    const st = s.current
    st.holding = false
    st.done = true
    st.p = 1
    render(1)
    jitter(0)
    setPhase('done')
    audio.chargeRelease()
    haptics.buzz([40, 30, 70, 40, 120])
    sceneRef.current?.charge(0)
    sceneRef.current?.pulse(1.6)
    celebrate()
    const ok = await copyText(email)
    if (ok) toast('Email copied. Talk soon! ✦')
    else st.pendingCopy = true
    st.timer = window.setTimeout(() => {
      st.done = false
      if (st.pendingCopy) {
        st.pendingCopy = false
        toast(email)
      }
      setPhase('idle')
      st.drain = gsap.to(st, { p: 0, duration: 1.2, ease: 'power2.inOut', onUpdate: () => render(st.p) })
    }, 2600)
  }

  const isHoldKey = (k: string) => k === ' ' || k === 'Enter'

  return (
    <button
      ref={btn}
      type="button"
      className={`hold is-${phase}`}
      data-cursor="Hold"
      aria-label={`Press and hold to copy my email address, ${email}`}
      onMouseEnter={fx.hover}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (!isHoldKey(e.key)) return
        e.preventDefault()
        if (!e.repeat) start()
      }}
      onKeyUp={(e) => {
        if (!isHoldKey(e.key)) return
        e.preventDefault()
        end()
      }}
      onBlur={() => s.current.holding && end()}
      onClick={(e) => {
        // Screen readers / switch access fire a synthetic click (detail 0): copy straight away.
        if (e.detail === 0 && !s.current.holding && !s.current.done) complete()
      }}
    >
      <span className="hold__glow" aria-hidden="true" />
      <span className="hold__shocks" ref={shocks} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="hold__sparks" aria-hidden="true">
        {SPARKS.map((sp, i) => (
          <i key={i} className={sp.streak ? 'is-streak' : undefined} style={{ '--a': `${sp.a}deg`, '--d': `${sp.d}s`, '--r': `${sp.r}px` } as CSSProperties} />
        ))}
      </span>

      <span className="hold__body" aria-hidden="true">
        <span className="hold__fill">
          <span className="hold__wave" />
          <span className="hold__wave hold__wave--2" />
        </span>
        <span className="hold__flash" ref={flash} />
        <span className="hold__label">
          <span className="hold__txt hold__txt--idle">
            <small>Press &amp; hold</small>
            Copy
            <br />
            email
          </span>
          <span className="hold__txt hold__txt--holding">
            <b>
              <span ref={pct}>0</span>
              <sup>%</sup>
            </b>
            <small>keep holding</small>
          </span>
          <span className="hold__txt hold__txt--done">
            <svg viewBox="0 0 24 24">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
            Copied!
          </span>
          <span className="hold__txt hold__txt--hint">
            <small>almost…</small>
            Hold it
            <br />
            down
          </span>
        </span>
      </span>

      <svg className="hold__progress" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="hold__track" cx="100" cy="100" r={R} />
        <circle ref={bar} className="hold__bar" cx="100" cy="100" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC} />
      </svg>

      <span className="hold__ring" ref={ring} aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <defs>
            <path id="hold-circ" d="M100,100 m-82,0 a82,82 0 1,1 164,0 a82,82 0 1,1 -164,0" />
          </defs>
          <text>
            <textPath href="#hold-circ" textLength="508" lengthAdjust="spacing">
              {ringText}
            </textPath>
          </text>
        </svg>
      </span>

      <span className="hold__burst" ref={burst} aria-hidden="true" />
    </button>
  )
}
