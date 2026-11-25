/**
 * The cookie / storage notice shown at the bottom of the page until the visitor
 * picks "Accept" or "Essential only". After that it never shows again (the
 * choice lives in localStorage), unless they reopen it from "Cookie settings".
 *
 * Client-only: it renders nothing until after hydration, so pre-rendered pages
 * never mismatch. It's a fixed card, so it doesn't push the page around, and it
 * isn't modal: the page stays usable, and Esc doesn't count as an answer.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { onConsentOpen, saveConsent, useConsent, type ConsentChoice } from './consent'
import './consent.css'

interface Props {
  /** "blog" uses the reading themes; "portfolio" the dark portfolio look */
  variant: 'blog' | 'portfolio'
  /** wait this long after the page is up before sliding in (ms) */
  delay?: number
  /** optional sound / haptic hooks */
  onHover?: () => void
  onPress?: () => void
}

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function CookieConsent({ variant, delay = 900, onHover, onPress }: Props) {
  const consent = useConsent()
  const [ready, setReady] = useState(false)
  const [reopened, setReopened] = useState(false)
  const [closing, setClosing] = useState(false)
  const box = useRef<HTMLElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const id = useId()

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), delay)
    return () => window.clearTimeout(t)
  }, [delay])

  // "Cookie settings" links reopen it, with focus on the first button
  useEffect(
    () =>
      onConsentOpen(() => {
        returnTo.current = document.activeElement as HTMLElement | null
        setClosing(false)
        setReady(true)
        setReopened(true)
        window.setTimeout(() => box.current?.querySelector<HTMLButtonElement>('button')?.focus(), 30)
      }),
    [],
  )

  const visible = ready && (reopened || !consent || closing)
  if (!visible || typeof document === 'undefined') return null

  const choose = (c: ConsentChoice) => {
    onPress?.()
    saveConsent(c)
    setReopened(false)
    setClosing(true)
    window.setTimeout(() => setClosing(false), 260)
    // keyboard users shouldn't be dropped at the top of the page
    const back = returnTo.current
    returnTo.current = null
    if (back && document.contains(back)) back.focus({ preventScroll: true })
  }

  return createPortal(
    <section ref={box} className={`cc cc--${variant}${closing ? ' is-leaving' : ''}`} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} data-lenis-prevent>
      <p className="cc__title" id={`${id}-t`} aria-live="polite">
        No tracking cookies here
      </p>
      <p className="cc__text" id={`${id}-d`}>
        I don’t run ads or analytics. Your browser keeps a few settings, like your theme and saved posts, so they’re still there next time. If you accept, it also remembers your recent searches and
        caches link previews.
      </p>
      {reopened && consent && (
        <p className="cc__now">
          Your current choice: <strong>{consent.choice === 'all' ? 'Accepted' : 'Essential only'}</strong>
          {consent.at ? `, ${fmt(consent.at)}` : ''}
        </p>
      )}
      <div className="cc__row">
        <button type="button" className="cc__btn cc__btn--main" onClick={() => choose('all')} onMouseEnter={onHover} data-cursor="Accept">
          Accept
        </button>
        <button type="button" className="cc__btn" onClick={() => choose('essential')} onMouseEnter={onHover} data-cursor="Essential">
          Essential only
        </button>
      </div>
      <p className="cc__links">
        <a href="/cookies">Cookie policy</a>
        <a href="/privacy">Privacy</a>
      </p>
    </section>,
    document.body,
  )
}
