import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, navigate } from '../router'
import { setPrefs, usePrefs, type Prefs } from '../prefs'
import { Icon, toast } from './ui'

/* ------------------------------------------------------------ focus music */

type Music = 'off' | 'piano' | 'bach' | 'nature'
const MUSIC: { id: Music; label: string; section: number }[] = [
  { id: 'off', label: 'Off', section: 4 },
  { id: 'piano', label: 'Piano', section: 4 },
  { id: 'bach', label: 'Bach', section: 7 },
  { id: 'nature', label: 'Nature', section: 8 },
]

let musicState: Music = 'off'
const musicListeners = new Set<(m: Music) => void>()

/** Optional reading music: borrows a piece from the portfolio's soundtrack. Loaded on demand. */
async function setMusic(m: Music) {
  musicState = m
  musicListeners.forEach((l) => l(m))
  const { audio } = await import('../../lib/audio')
  if (m === 'off') return audio.setMuted(true)
  audio.setTheme('soundtrack')
  audio.setSection(MUSIC.find((x) => x.id === m)!.section)
  await audio.setMuted(false)
}

function useMusic() {
  const [m, setM] = useState(musicState)
  useEffect(() => {
    musicListeners.add(setM)
    return () => {
      musicListeners.delete(setM)
    }
  }, [])
  return m
}

/* --------------------------------------------------------------- settings */

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="b-seg" role="radiogroup" aria-label={label}>
      <span className="b-seg__label">{label}</span>
      <div className="b-seg__opts">
        {options.map((o) => (
          <button key={String(o.v)} role="radio" aria-checked={value === o.v} className={value === o.v ? 'is-on' : ''} onClick={() => onChange(o.v)}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePrefs()
  const music = useMusic()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.b-settings-btn')) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    panel.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]')?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open, onClose])
  return (
    <div className={`b-settings ${open ? 'is-open' : ''}`} ref={panel} role="dialog" aria-label="Reading settings" aria-hidden={!open} inert={!open}>
      <p className="b-settings__title">Reading settings</p>
      <Seg<Prefs['theme']>
        label="Theme"
        value={prefs.theme}
        onChange={(theme) => setPrefs({ theme })}
        options={[
          { v: 'auto', l: 'Auto' },
          { v: 'light', l: 'Light' },
          { v: 'sepia', l: 'Sepia' },
          { v: 'dark', l: 'Dark' },
        ]}
      />
      <Seg<Prefs['size']>
        label="Text size"
        value={prefs.size}
        onChange={(size) => setPrefs({ size })}
        options={[
          { v: 0, l: 'S' },
          { v: 1, l: 'M' },
          { v: 2, l: 'L' },
          { v: 3, l: 'XL' },
        ]}
      />
      <Seg<Prefs['font']>
        label="Font"
        value={prefs.font}
        onChange={(font) => setPrefs({ font })}
        options={[
          { v: 'serif', l: 'Serif' },
          { v: 'sans', l: 'Sans' },
        ]}
      />
      <Seg<Prefs['width']>
        label="Line width"
        value={prefs.width}
        onChange={(width) => setPrefs({ width })}
        options={[
          { v: 'normal', l: 'Comfortable' },
          { v: 'wide', l: 'Wide' },
        ]}
      />
      <Seg<Music> label="Focus music" value={music} onChange={(m) => setMusic(m)} options={MUSIC.map((m) => ({ v: m.id, l: m.label }))} />
      <p className="b-settings__hint">Saved on this device. Music is generated live, quiet, with no ads or tracking.</p>
    </div>
  )
}

/* ----------------------------------------------------------------- header */

export function Header() {
  const [open, setOpen] = useState(false)
  const music = useMusic()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    // hide on scroll down, show on scroll up: more room for reading
    let last = window.scrollY
    const on = () => {
      const y = window.scrollY
      setHidden(y > 160 && y > last + 4 ? true : y < last - 4 ? false : (h) => h)
      last = y
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  // never hide while the settings panel is open
  const isHidden = hidden && !open
  return (
    <header className={`b-header ${isHidden ? 'is-hidden' : ''}`}>
      <a className="b-skip" href="#main">
        Skip to content
      </a>
      <div className="b-header__in">
        <a href="/" className="b-logo" aria-label="Muhammad Gulzaib: portfolio home">
          <span className="b-logo__mark" aria-hidden="true" />
          GUL
        </a>
        <Link href="/blog" className="b-header__title">
          Notebook
        </Link>
        <nav className="b-header__nav" aria-label="Blog">
          <Link href="/blog">Writing</Link>
          <Link href="/blog#topics">Topics</Link>
          <a href="/">Portfolio</a>
        </nav>
        <div className="b-header__tools">
          <button className="b-iconbtn" onClick={() => navigate('/blog?focus=search')} aria-label="Search posts" title="Search (/)">
            <Icon name="search" />
          </button>
          <a className="b-iconbtn" href="/rss.xml" aria-label="RSS feed" title="RSS feed">
            <Icon name="rss" />
          </a>
          <button
            className={`b-iconbtn b-settings-btn ${music !== 'off' ? 'is-playing' : ''}`}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="Reading settings"
            title="Reading settings: theme, text size, font, music"
          >
            <span className="b-aa" aria-hidden="true">
              Aa
            </span>
            {music !== 'off' && <span className="b-playing-dot" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <Settings open={open} onClose={() => setOpen(false)} />
    </header>
  )
}

/* ------------------------------------------------------------- newsletter */

const ENDPOINT = import.meta.env.VITE_NEWSLETTER_ENDPOINT as string | undefined

export function Newsletter({ compact }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Please enter a valid email')
    if (ENDPOINT) {
      setState('sending')
      try {
        await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source: location.pathname }) })
        setState('done')
      } catch {
        setState('idle')
        toast('Could not subscribe. Please try again.')
      }
    } else {
      // no backend configured: hand off to email so no address is ever lost
      window.location.href = `mailto:iigulzaib@gmail.com?subject=${encodeURIComponent('Subscribe me to the Notebook')}&body=${encodeURIComponent(`Please add ${email} to the newsletter.`)}`
      setState('done')
    }
  }
  return (
    <section className={`b-newsletter ${compact ? 'is-compact' : ''}`} aria-labelledby="nl-title">
      <div>
        <p className="b-kicker">Newsletter</p>
        <h2 id="nl-title">One useful email when a new post is out.</h2>
        <p>Founder lessons, engineering deep dives and AI notes. No spam, unsubscribe anytime. Prefer feeds? Use <a href="/rss.xml">RSS</a>.</p>
      </div>
      {state === 'done' ? (
        <p className="b-newsletter__done">Thanks! You’re on the list.</p>
      ) : (
        <form onSubmit={submit} className="b-newsletter__form">
          <label htmlFor={compact ? 'nl-email-c' : 'nl-email'} className="sr-only">
            Email address
          </label>
          <input id={compact ? 'nl-email-c' : 'nl-email'} type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button type="submit" className="b-btn" disabled={state === 'sending'}>
            {state === 'sending' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </form>
      )}
    </section>
  )
}

/* ----------------------------------------------------------------- author */

export function AuthorCard() {
  return (
    <section className="b-author" aria-label="About the author">
      <span className="b-author__avatar" aria-hidden="true">
        MG
      </span>
      <div>
        <p className="b-kicker">Written by</p>
        <p className="b-author__name">Muhammad Gulzaib</p>
        <p className="b-author__bio">
          Founder &amp; CEO of SynergyFlow Labs and a senior full stack engineer. I build AI-native SaaS with Laravel, React and agentic AI, and write about what I learn shipping it. Based in Islamabad, open to remote
          work and relocation to the UAE/KSA.
        </p>
        <p className="b-author__links">
          <a href="/">Portfolio</a>
          <a href="https://www.linkedin.com/in/gulzaib-ai" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <a href="https://github.com/imgul" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="mailto:iigulzaib@gmail.com">Email</a>
        </p>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- footer */

export function Footer() {
  return (
    <footer className="b-footer">
      <div className="b-footer__in">
        <p>
          © {new Date().getFullYear()} Muhammad Gulzaib. Words are my own; code samples are MIT unless noted.
        </p>
        <nav aria-label="Footer">
          <Link href="/blog">All posts</Link>
          <a href="/rss.xml">RSS</a>
          <a href="/feed.json">JSON feed</a>
          <a href="/">Portfolio</a>
          <a href="mailto:iigulzaib@gmail.com">Contact</a>
        </nav>
      </div>
    </footer>
  )
}

export function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const on = () => setShow(window.scrollY > 1200)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <button className={`b-top ${show ? 'is-on' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" tabIndex={show ? 0 : -1}>
      <Icon name="up" />
    </button>
  )
}
