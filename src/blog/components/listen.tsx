/**
 * Listen: reads the post aloud with the browser's built-in speech engine
 * (no audio files, works offline). Highlights and follows the paragraph being
 * read, so it doubles as a read-along aid.
 */
import { useEffect, useRef, useState } from 'react'
import { reduceMotion } from '../prefs'
import { Icon } from './ui'

type State = 'idle' | 'playing' | 'paused'
const RATES = [0.8, 1, 1.2, 1.4]
const BLOCKS = 'h2, h3, p, li, blockquote, figcaption, dt, dd'

let control: { toggle: () => void } | null = null
/** Lets the "l" keyboard shortcut start / pause reading. */
export const toggleListen = () => control?.toggle()

export function Listen({ root }: { root: React.RefObject<HTMLElement | null> }) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<State>('idle')
  const [rate, setRate] = useState(1)
  const queue = useRef<HTMLElement[]>([])
  const idx = useRef(0)
  const rateRef = useRef(1)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window)
    return () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel()
      document.querySelectorAll('.is-speaking').forEach((el) => el.classList.remove('is-speaking'))
    }
  }, [])

  const mark = (el?: HTMLElement) => {
    document.querySelectorAll('.is-speaking').forEach((e) => e.classList.remove('is-speaking'))
    if (!el) return
    el.classList.add('is-speaking')
    const r = el.getBoundingClientRect()
    if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' })
  }

  const speakFrom = (i: number) => {
    speechSynthesis.cancel()
    idx.current = i
    const el = queue.current[i]
    if (!el) {
      mark()
      setState('idle')
      return
    }
    const text = (el.innerText || '').replace(/\s*#\s*$/, '').replace(/\[\d+\]/g, '').trim()
    if (!text) return speakFrom(i + 1)
    const u = new SpeechSynthesisUtterance(text)
    u.rate = rateRef.current
    u.lang = 'en'
    const voice = speechSynthesis.getVoices().find((v) => /en[-_](GB|US)/i.test(v.lang) && /natural|neural|google|samantha|daniel/i.test(v.name))
    if (voice) u.voice = voice
    u.onend = () => idx.current === i && speakFrom(i + 1)
    mark(el)
    speechSynthesis.speak(u)
    setState('playing')
  }

  const start = () => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>(BLOCKS) ?? [])].filter(
      (el) => !el.closest('pre, .b-code, .b-filetree, .b-refs, .footnotes, [hidden], .sr-only, button') && !el.parentElement?.closest('li, blockquote'),
    )
    queue.current = els
    // start from the first block on screen, so "listen" continues where you are
    const first = els.findIndex((el) => el.getBoundingClientRect().bottom > 90)
    speakFrom(Math.max(0, first))
  }

  const toggle = () => {
    if (state === 'idle') start()
    else if (state === 'playing') {
      speechSynthesis.pause()
      setState('paused')
    } else {
      speechSynthesis.resume()
      setState('playing')
    }
  }
  const stop = () => {
    idx.current = -1
    speechSynthesis.cancel()
    mark()
    setState('idle')
  }
  control = { toggle }

  if (!supported) return null
  return (
    <div className={`b-listen ${state !== 'idle' ? 'is-active' : ''}`} role="group" aria-label="Listen to this post">
      <button type="button" className="b-action" onClick={toggle} aria-pressed={state === 'playing'} title="Listen (l)">
        <Icon name={state === 'playing' ? 'pause' : state === 'paused' ? 'play' : 'headphones'} size={16} />
        <span>{state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen'}</span>
      </button>
      {state !== 'idle' && (
        <>
          <button
            type="button"
            className="b-action is-icon"
            onClick={() => {
              const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
              setRate(r)
              rateRef.current = r
              if (state === 'playing') speakFrom(idx.current)
            }}
            aria-label={`Reading speed ${rate} times. Change speed`}
          >
            {rate}×
          </button>
          <button type="button" className="b-action is-icon" onClick={stop} aria-label="Stop listening">
            <Icon name="stop" size={14} />
          </button>
        </>
      )}
    </div>
  )
}
