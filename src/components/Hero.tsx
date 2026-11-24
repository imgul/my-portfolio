import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useStore } from '../lib/store'
import { fx } from '../lib/feedback'
import { scrollTo } from '../lib/scroll'
import { profile } from '../data/content'
import { useMagnetic } from '../lib/hooks'

const ROTATE = ['SaaS platforms', 'AI agents', 'RAG pipelines', 'ERP systems', 'startups', 'things people pay for']

function Letters({ word, offset }: { word: string; offset: number }) {
  return (
    <>
      {word.split('').map((c, i) => (
        <span className="mask" key={i}>
          <span
            className="ch"
            onPointerEnter={(e) => {
              fx.note(offset + i)
              gsap.fromTo(e.currentTarget, { yPercent: 0 }, { yPercent: -14, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' })
            }}
          >
            {c}
          </span>
        </span>
      ))}
    </>
  )
}

export default function Hero() {
  const entered = useStore((s) => s.entered)
  const root = useRef<HTMLElement>(null)
  const cta = useRef<HTMLButtonElement>(null)
  useMagnetic(cta, 0.4)

  // Intro
  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 })
      tl.from('.hero__name .ch', { yPercent: 120, rotate: 8, duration: 1.4, stagger: 0.035, ease: 'expo.out' })
        .from('.hero__meta > *', { y: 20, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out' }, '-=1.1')
        .from('.hero__bottom > *', { y: 30, opacity: 0, stagger: 0.1, duration: 1.1, ease: 'expo.out' }, '-=0.9')
    }, root)
    return () => ctx.revert()
  }, [entered])

  // Rotating word
  useEffect(() => {
    if (!entered) return
    const words = gsap.utils.toArray<HTMLElement>('.rotator__word')
    gsap.set(words, { yPercent: 110, opacity: 0 })
    gsap.set(words[0], { yPercent: 0, opacity: 1 })
    let i = 0
    const id = setInterval(() => {
      const cur = words[i]
      i = (i + 1) % words.length
      const nxt = words[i]
      gsap.to(cur, { yPercent: -110, opacity: 0, duration: 0.7, ease: 'expo.inOut' })
      gsap.fromTo(nxt, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.inOut' })
    }, 2200)
    return () => clearInterval(id)
  }, [entered])

  // Scroll-out parallax
  useEffect(() => {
    if (!entered) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } })
      tl.to('.hero__line--1', { xPercent: -18, opacity: 0.1 }, 0)
        .to('.hero__line--2', { xPercent: 14, opacity: 0.1 }, 0)
        .to('.hero__bottom, .hero__meta', { y: -80, opacity: 0 }, 0)
    }, root)
    return () => ctx.revert()
  }, [entered])

  return (
    <section className="hero" ref={root} data-shape="0" data-index="0" id="top">
      <div className="hero__meta mono">
        <span>
          <i className="pulse-dot" /> Available for remote / relocation
        </span>
        <span>Founder &amp; CEO, SynergyFlow Labs</span>
        <span>{profile.location}</span>
      </div>

      <h1 className="hero__name" aria-label={profile.name}>
        <span className="hero__line hero__line--1" aria-hidden="true">
          <Letters word="MUHAMMAD" offset={0} />
        </span>
        <span className="hero__line hero__line--2" aria-hidden="true">
          <Letters word="GULZAIB" offset={3} />
          <span className="hero__star" aria-hidden="true">
            ✲
          </span>
        </span>
      </h1>

      <div className="hero__bottom">
        <div className="hero__rotator">
          <span className="mono label">I build</span>
          <span className="rotator">
            {ROTATE.map((w) => (
              <span className="rotator__word" key={w}>
                {w}
              </span>
            ))}
          </span>
        </div>
        <div className="hero__intro">
          <p>
            Senior Full Stack Engineer and founder. I have spent <strong>5+ years</strong> building SaaS and AI-powered products with{' '}
            <strong>Laravel</strong>, <strong>React</strong> and <strong>agentic AI</strong>, and I care as much about the business as the code.
          </p>
          <div className="hero__ctas">
            <button className="btn btn--primary" ref={cta} onClick={() => (fx.click(), scrollTo('#ventures'))} onMouseEnter={fx.hover} data-cursor="Go">
              See what I’m building
              <span className="arrow">↓</span>
            </button>
            <a className="link-u mono" href={`mailto:${profile.email}`} onMouseEnter={fx.hover} onClick={fx.click}>
              {profile.email}
            </a>
          </div>
        </div>
      </div>
      <p className="hero__tip mono" aria-hidden="true">
        psst, hover my name ♪
      </p>
    </section>
  )
}
