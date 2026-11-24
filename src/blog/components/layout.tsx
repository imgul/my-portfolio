import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, navigate, useLocation } from '../router'
import { DEFAULTS, resetPrefs, setPrefs, THEME_BG, usePrefs, type Prefs } from '../prefs'
import { useReader } from '../store'
import { useHydrated } from '../hydrated'
import { Icon, toast } from './ui'
import { OrcidLink, ResearchProfiles } from './scholar'
import { activeProfiles } from '../scholar.mjs'

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

/** Radio group with roving focus (arrow keys move and select, like native radios). */
function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: { v: T; l: ReactNode; aria?: string; className?: string }[]
  onChange: (v: T) => void
  hint?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const id = `seg-${label.replace(/\W+/g, '-').toLowerCase()}`
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + options.length) % options.length
    onChange(options[n].v)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[n]?.focus()
  }
  return (
    <div className="b-seg">
      <span className="b-seg__label" id={id}>
        {label}
      </span>
      <div className="b-seg__opts" role="radiogroup" aria-labelledby={id} aria-describedby={hint ? `${id}-hint` : undefined} ref={ref}>
        {options.map((o, i) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            aria-label={o.aria}
            tabIndex={value === o.v ? 0 : -1}
            className={`${value === o.v ? 'is-on' : ''} ${o.className ?? ''}`}
            onClick={() => onChange(o.v)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.l}
          </button>
        ))}
      </div>
      {hint && (
        <p className="b-seg__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}

const THEMES: { v: Prefs['theme']; l: string; hint: string }[] = [
  { v: 'auto', l: 'Auto', hint: 'Follows your device: Light by day, Dim at night.' },
  { v: 'light', l: 'Light', hint: 'Warm off-white paper. Softer than pure white for long reads.' },
  { v: 'sepia', l: 'Sepia', hint: 'Low blue light, like an old book. Easy in the evening.' },
  { v: 'dim', l: 'Dim', hint: 'Soft charcoal, not black: less halation and eye strain than pure dark modes.' },
  { v: 'night', l: 'Night', hint: 'Very dark and warm (amber text) for reading in bed with the lights off.' },
]
const SIZES = ['Smaller', 'Default', 'Large', 'Larger', 'Largest']

function Swatch({ t }: { t: Prefs['theme'] }) {
  if (t === 'auto')
    return (
      <span className="b-swatch is-auto" aria-hidden="true">
        <span style={{ background: THEME_BG.light }} />
        <span style={{ background: THEME_BG.dim }} />
      </span>
    )
  return (
    <span className="b-swatch" data-swatch={t} aria-hidden="true">
      Aa
    </span>
  )
}

export function Settings({ open, onClose, returnFocus }: { open: boolean; onClose: () => void; returnFocus: () => void }) {
  const prefs = usePrefs()
  const music = useMusic()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        returnFocus()
      }
    }
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
  }, [open, onClose, returnFocus])
  const changed = (Object.keys(DEFAULTS) as (keyof Prefs)[]).some((k) => prefs[k] !== DEFAULTS[k])
  return (
    <div id="b-settings" className={`b-settings ${open ? 'is-open' : ''}`} ref={panel} role="dialog" aria-labelledby="b-settings-title" aria-hidden={!open} inert={!open}>
      <div className="b-settings__head">
        <p className="b-settings__title" id="b-settings-title">
          Reading settings
        </p>
        <button
          type="button"
          className="b-iconbtn is-sm"
          onClick={() => {
            onClose()
            returnFocus()
          }}
          aria-label="Close reading settings"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <Seg<Prefs['theme']>
        label="Theme"
        value={prefs.theme}
        onChange={(theme) => setPrefs({ theme })}
        options={THEMES.map((t) => ({ v: t.v, l: <><Swatch t={t.v} /><span>{t.l}</span></>, className: 'is-theme' }))}
        hint={THEMES.find((t) => t.v === prefs.theme)?.hint}
      />
      <div className="b-seg">
        <span className="b-seg__label" id="seg-size">
          Text size
        </span>
        <div className="b-stepper" role="group" aria-labelledby="seg-size">
          <button type="button" onClick={() => setPrefs({ size: Math.max(0, prefs.size - 1) as Prefs['size'] })} disabled={prefs.size === 0} aria-label="Smaller text">
            <span style={{ fontSize: '0.8em' }}>A</span>
          </button>
          <output aria-live="polite">
            <span className="b-stepper__dots" aria-hidden="true">
              {SIZES.map((_, i) => (
                <i key={i} className={i <= prefs.size ? 'is-on' : ''} />
              ))}
            </span>
            {SIZES[prefs.size]}
          </output>
          <button type="button" onClick={() => setPrefs({ size: Math.min(4, prefs.size + 1) as Prefs['size'] })} disabled={prefs.size === 4} aria-label="Larger text">
            <span style={{ fontSize: '1.25em' }}>A</span>
          </button>
        </div>
      </div>
      <Seg<Prefs['font']>
        label="Typeface"
        value={prefs.font}
        onChange={(font) => setPrefs({ font })}
        options={[
          { v: 'serif', l: 'Serif', className: 'is-f-serif' },
          { v: 'sans', l: 'Sans', className: 'is-f-sans' },
          { v: 'legible', l: 'Hyperlegible', className: 'is-f-legible', aria: 'Atkinson Hyperlegible: designed for low vision readers' },
        ]}
        hint={prefs.font === 'legible' ? 'Atkinson Hyperlegible: distinct letter shapes for low vision and dyslexic readers.' : undefined}
      />
      <Seg<Prefs['leading']>
        label="Line spacing"
        value={prefs.leading}
        onChange={(leading) => setPrefs({ leading })}
        options={[
          { v: 'tight', l: 'Compact' },
          { v: 'normal', l: 'Normal' },
          { v: 'loose', l: 'Relaxed' },
        ]}
      />
      <Seg<Prefs['width']>
        label="Line length"
        value={prefs.width}
        onChange={(width) => setPrefs({ width })}
        options={[
          { v: 'narrow', l: 'Narrow' },
          { v: 'normal', l: 'Normal' },
          { v: 'wide', l: 'Wide' },
        ]}
      />
      <div className="b-settings__row">
        <Seg<Prefs['contrast']>
          label="Contrast"
          value={prefs.contrast}
          onChange={(contrast) => setPrefs({ contrast })}
          options={[
            { v: 'normal', l: 'Soft' },
            { v: 'high', l: 'High' },
          ]}
        />
        <Seg<Prefs['motion']>
          label="Motion"
          value={prefs.motion}
          onChange={(motion) => setPrefs({ motion })}
          options={[
            { v: 'auto', l: 'On' },
            { v: 'reduce', l: 'Reduced' },
          ]}
        />
      </div>
      <Seg<Music> label="Focus music" value={music} onChange={(m) => setMusic(m)} options={MUSIC.map((m) => ({ v: m.id, l: m.label }))} />
      <div className="b-settings__foot">
        <p className="b-settings__hint">Saved on this device only.</p>
        <button type="button" className="b-linkbtn" onClick={() => (resetPrefs(), toast('Reading settings reset'))} disabled={!changed}>
          <Icon name="reset" size={14} /> Reset
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ shortcuts */

const SHORTCUTS: [string[], string][] = [
  [['/'], 'Search posts'],
  [['j', 'k'], 'Next / previous section (in a post)'],
  [['s'], 'Save or unsave this post'],
  [['f'], 'Focus mode: hide everything but the text'],
  [['l'], 'Listen: read the post aloud'],
  [['t'], 'Cycle theme'],
  [['+', '−'], 'Larger / smaller text'],
  [['g', 'h'], 'Go to the blog home'],
  [['?'], 'Show this help'],
  [['Esc'], 'Close panels'],
]

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="b-dialog" aria-labelledby="kbd-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="b-dialog__in">
        <div className="b-settings__head">
          <h2 id="kbd-title" className="b-settings__title">
            Keyboard shortcuts
          </h2>
          <button type="button" className="b-iconbtn is-sm" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <dl className="b-shortcuts">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label}>
              <dt>
                {keys.map((k) => (
                  <kbd key={k} className="b-kbd">
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <p className="b-settings__hint">Shortcuts are ignored while you type in a field.</p>
      </div>
    </dialog>
  )
}

const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || e.metaKey || e.ctrlKey || e.altKey
}
export const isTypingEvent = typing

/* ----------------------------------------------------------------- header */

const THEME_CYCLE: Prefs['theme'][] = ['light', 'sepia', 'dim', 'night']

export function Header() {
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const music = useMusic()
  const prefs = usePrefs()
  const { saved } = useReader()
  const hydrated = useHydrated()
  const { path } = useLocation()
  const [hidden, setHidden] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)

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

  // global shortcuts (post-specific ones live in PostPage)
  useEffect(() => {
    let g = 0
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.defaultPrevented) return
      if (e.key === '?') return setHelp(true)
      if (e.key === 't') {
        const i = THEME_CYCLE.indexOf(prefs.theme as Prefs['theme'])
        const theme = THEME_CYCLE[(i + 1) % THEME_CYCLE.length]
        setPrefs({ theme })
        return toast(`Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`)
      }
      if (e.key === '+' || e.key === '=') return setPrefs({ size: Math.min(4, prefs.size + 1) as Prefs['size'] })
      if (e.key === '-' || e.key === '_') return setPrefs({ size: Math.max(0, prefs.size - 1) as Prefs['size'] })
      if (e.key === 'g') {
        g = Date.now()
        return
      }
      if (e.key === 'h' && Date.now() - g < 800) navigate('/blog')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prefs.theme, prefs.size])

  const isHidden = hidden && !open
  const nSaved = hydrated ? saved.length : 0
  return (
    <>
      <a className="b-skip" href="#main">
        Skip to content
      </a>
      <header className={`b-header ${isHidden ? 'is-hidden' : ''}`}>
        <div className="b-header__in">
          <a href="/" className="b-logo" aria-label="Muhammad Gulzaib: portfolio home">
            <span className="b-logo__mark" aria-hidden="true" />
            GUL
          </a>
          <Link href="/blog" className="b-header__title" aria-current={path === '/blog' ? 'page' : undefined}>
            Notebook
          </Link>
          <nav className="b-header__nav" aria-label="Blog">
            <Link href="/blog#topics">Topics</Link>
            <Link href="/blog?saved=1" className="b-header__saved">
              Saved{nSaved > 0 && <span className="b-count">{nSaved}</span>}
            </Link>
            <a href="/">Portfolio</a>
          </nav>
          <div className="b-header__tools">
            <button type="button" className="b-iconbtn" onClick={() => navigate('/blog?focus=search')} aria-label="Search posts" title="Search (/)">
              <Icon name="search" />
            </button>
            <button type="button" className="b-iconbtn is-desk" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
              <Icon name="keyboard" />
            </button>
            <button
              ref={btn}
              type="button"
              className={`b-iconbtn b-settings-btn ${music !== 'off' ? 'is-playing' : ''}`}
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="b-settings"
              aria-label="Reading settings"
              title="Reading settings: theme, text size, typeface, spacing, music"
            >
              <span className="b-aa" aria-hidden="true">
                Aa
              </span>
              {music !== 'off' && <span className="b-playing-dot" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <Settings open={open} onClose={() => setOpen(false)} returnFocus={() => btn.current?.focus()} />
      </header>
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </>
  )
}

/* ------------------------------------------------------------- newsletter */

const ENDPOINT = import.meta.env.VITE_NEWSLETTER_ENDPOINT as string | undefined

export function Newsletter({ compact }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')
  const id = compact ? 'nl-email-c' : 'nl-email'
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid email address, like you@company.com.')
    setError('')
    if (ENDPOINT) {
      setState('sending')
      try {
        await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source: location.pathname }) })
        setState('done')
      } catch {
        setState('idle')
        setError('Could not subscribe. Please try again in a moment.')
      }
    } else {
      // no backend configured: hand off to email so no address is ever lost
      window.location.href = `mailto:iigulzaib@gmail.com?subject=${encodeURIComponent('Subscribe me to the Notebook')}&body=${encodeURIComponent(`Please add ${email} to the newsletter.`)}`
      setState('done')
    }
  }
  return (
    <section className={`b-newsletter ${compact ? 'is-compact' : ''}`} aria-labelledby={`${id}-title`}>
      <div>
        <p className="b-kicker">Newsletter</p>
        <h2 id={`${id}-title`}>One useful email when a new post is out.</h2>
        <p>
          Founder lessons, engineering deep dives and AI notes, about twice a month. No spam, unsubscribe anytime. Prefer feeds? Use <a href="/rss.xml">RSS</a>.
        </p>
      </div>
      {state === 'done' ? (
        <p className="b-newsletter__done" role="status">
          <Icon name="check" size={16} /> Thanks! You’re on the list.
        </p>
      ) : (
        <form onSubmit={submit} className="b-newsletter__form" noValidate>
          <label htmlFor={id} className="sr-only">
            Email address
          </label>
          <input
            id={id}
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <button type="submit" className="b-btn" disabled={state === 'sending'}>
            {state === 'sending' ? 'Subscribing…' : 'Subscribe'}
          </button>
          {error && (
            <p className="b-field-error" id={`${id}-err`} role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  )
}

/* ----------------------------------------------------------------- author */

export function AuthorCard() {
  return (
    <section className="b-author" aria-labelledby="author-name">
      <span className="b-author__avatar" aria-hidden="true">
        MG
      </span>
      <div>
        <p className="b-kicker">Written by</p>
        <h2 className="b-author__name" id="author-name">
          Muhammad Gulzaib
        </h2>
        <p className="b-author__bio">
          Founder &amp; CEO of SynergyFlow Labs and a senior full stack engineer. I build AI-native SaaS with Laravel, React and agentic AI, and write about what I learn shipping it. Based in Islamabad, open to remote
          work and relocation to the UAE/KSA.
        </p>
        <p className="b-author__orcid">
          <OrcidLink />
        </p>
        {activeProfiles(true).length > 1 && <ResearchProfiles className="is-compact" />}
        <p className="b-author__links">
          <a href="/">Portfolio</a>
          <Link href="/blog/research">Research &amp; citation</Link>
          <a href="https://www.linkedin.com/in/gulzaib-ai" target="_blank" rel="noopener noreferrer me">
            LinkedIn
          </a>
          <a href="https://github.com/imgul" target="_blank" rel="noopener noreferrer me">
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
        <div>
          <p className="b-footer__brand">Gul’s Notebook</p>
          <p>
            © {new Date().getFullYear()} Muhammad Gulzaib. AI Research, Engineering and Writing posts are open access under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer" target="_blank">
              CC BY 4.0<span className="sr-only"> (opens in a new tab)</span>
            </a>
            ; Founder posts are all rights reserved; code samples are MIT.
          </p>
          <p className="b-footer__a11y">
            Built to be read: WCAG 2.2 AA contrast in every theme, keyboard and screen-reader friendly. Press <kbd className="b-kbd">?</kbd> for shortcuts.
          </p>
        </div>
        <nav aria-label="Footer">
          <Link href="/blog">All posts</Link>
          <Link href="/blog/research">Research &amp; citation</Link>
          <a href="/rss.xml">RSS</a>
          <a href="/feed.json">JSON feed</a>
          <a href="/llms.txt">llms.txt</a>
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
    <button
      type="button"
      className={`b-top ${show ? 'is-on' : ''}`}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        document.getElementById('main')?.focus({ preventScroll: true })
      }}
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      <Icon name="up" />
    </button>
  )
}
