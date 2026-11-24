/**
 * Every component a post can use. Markdown elements (headings, links, code,
 * tables, images, quotes) are upgraded automatically; the rest are used in MDX
 * as tags, with no imports needed. See the writing guide post for examples.
 *
 * Founders:      Stats/Stat, Timeline/Event, Decision, ProsCons, PullQuote, Takeaways
 * Engineers:     code blocks (title, line highlights, copy), Tabs/Tab, FileTree, Steps/Step, Kbd
 * AI research:   Abstract, Cite + frontmatter references (listed automatically), math ($…$ / $$…$$), BarChart, Flow
 * Tech writers:  Callout, TLDR, Sidenote, Term, Details, Figure, LinkCard/PostLink, Update
 */
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link } from '../router'
import { copy, Icon } from './ui'
import { CATEGORY_COLOR, getPost, postUrl, type PostMeta } from '../data'
import { CoverArt } from './CoverArt'

export const PostContext = createContext<PostMeta | null>(null)
/** true when rendering for feeds / Markdown copies: no interactive chrome, every tab visible. */
export const StaticContext = createContext(false)

/* --------------------------------------------------------------- headings */

function Heading({ as: Tag, id, children, ...rest }: { as: 'h2' | 'h3' | 'h4' } & ComponentProps<'h2'>) {
  const isStatic = useContext(StaticContext)
  if (!id || rest.className === 'sr-only' || isStatic) return <Tag id={id} {...rest}>{children}</Tag>
  const link = (e: React.MouseEvent) => {
    e.preventDefault()
    const url = `${location.origin}${location.pathname}#${id}`
    history.replaceState(null, '', `#${id}`)
    copy(url, 'Link to section copied')
  }
  return (
    <Tag id={id} {...rest} className="b-h" tabIndex={-1}>
      {children}
      <a className="b-h__anchor" href={`#${id}`} onClick={link} aria-label="Copy link to this section" title="Copy link to this section">
        #
      </a>
    </Tag>
  )
}

/* ------------------------------------------------------------------ links */

function A({ href = '', children, ...rest }: ComponentProps<'a'>) {
  if (href.startsWith('/blog')) return <Link href={href} {...rest}>{children}</Link>
  if (href.startsWith('#') || href.startsWith('/')) return <a href={href} {...rest}>{children}</a>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="b-ext" {...rest}>
      {children}
    </a>
  )
}

/* ------------------------------------------------------------------- code */

function Pre(props: ComponentProps<'pre'> & { 'data-language'?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  const [done, setDone] = useState(false)
  const [wrap, setWrap] = useState(false)
  const isStatic = useContext(StaticContext)
  const lang = props['data-language']
  if (isStatic) return <pre {...props} />
  const onCopy = () => {
    const text = [...(ref.current?.querySelectorAll('[data-line]') ?? [])].map((l) => l.textContent).join('\n') || ref.current?.textContent || ''
    copy(text, 'Code copied')
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }
  return (
    <div className={`b-code ${wrap ? 'is-wrapped' : ''}`}>
      <div className="b-code__bar">
        <span className="b-code__lang">{lang && lang !== 'plaintext' ? lang : 'text'}</span>
        <button type="button" className="b-code__btn" onClick={() => setWrap(!wrap)} aria-pressed={wrap} title="Wrap long lines">
          <Icon name="wrap" size={15} /> <span className="b-code__btnlabel">Wrap</span>
        </button>
        <button type="button" className="b-code__btn" onClick={onCopy} aria-label={done ? 'Code copied' : 'Copy code'}>
          <Icon name={done ? 'check' : 'copy'} size={15} /> {done ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref} {...props} tabIndex={0} aria-label={`${lang && lang !== 'plaintext' ? lang : 'Text'} code sample`} />
    </div>
  )
}

/* ------------------------------------------------------------ media/table */

function Img({ alt = '', ...rest }: ComponentProps<'img'>) {
  return <img alt={alt} loading="lazy" decoding="async" {...rest} />
}

function Table(props: ComponentProps<'table'>) {
  return (
    <div className="b-table" tabIndex={0} role="region" aria-label="Table">
      <table {...props} />
    </div>
  )
}

export function Figure({ src, alt = '', caption, credit, children, wide }: { src?: string; alt?: string; caption?: ReactNode; credit?: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    <figure className={`b-figure ${wide ? 'is-wide' : ''}`}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : children}
      {(caption || credit) && (
        <figcaption>
          {caption}
          {credit && <span className="b-figure__credit"> {credit}</span>}
        </figcaption>
      )}
    </figure>
  )
}

export function YouTube({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false)
  return (
    <figure className="b-figure b-video">
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <button className="b-video__poster" onClick={() => setOn(true)} style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }} aria-label={`Play video: ${title}`}>
          <span className="b-video__play">▶</span>
        </button>
      )}
      <figcaption>{title}</figcaption>
    </figure>
  )
}

/* --------------------------------------------------------------- callouts */

const CALLOUT_LABEL = { note: 'Note', tip: 'Tip', warning: 'Warning', danger: 'Careful', insight: 'Insight', success: 'Result' } as const
const CALLOUT_ICON = { note: 'i', tip: '✦', warning: '!', danger: '⨯', insight: '◆', success: '✓' } as const

export function Callout({ type = 'note', title, children }: { type?: keyof typeof CALLOUT_LABEL; title?: ReactNode; children: ReactNode }) {
  return (
    <aside className={`b-callout is-${type}`} role="note">
      <span className="b-callout__icon" aria-hidden="true">
        {CALLOUT_ICON[type]}
      </span>
      <div>
        <p className="b-callout__title">{title ?? CALLOUT_LABEL[type]}</p>
        <div className="b-callout__body">{children}</div>
      </div>
    </aside>
  )
}

export function TLDR({ children }: { children: ReactNode }) {
  return (
    <aside className="b-tldr" aria-label="Summary">
      <p className="b-kicker">TL;DR</p>
      {children}
    </aside>
  )
}

export function Takeaways({ title = 'Key takeaways', children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="b-takeaways" aria-label={title}>
      <p className="b-kicker">{title}</p>
      {children}
    </aside>
  )
}

export function Abstract({ children }: { children: ReactNode }) {
  return (
    <section className="b-abstract" aria-label="Abstract">
      <p className="b-kicker">Abstract</p>
      {children}
    </section>
  )
}

export function Update({ date, children }: { date: string; children: ReactNode }) {
  return (
    <aside className="b-update" role="note">
      <span className="b-kicker">Update · {date}</span>
      <div>{children}</div>
    </aside>
  )
}

export function PullQuote({ children, cite }: { children: ReactNode; cite?: string }) {
  return (
    <figure className="b-pullquote">
      <blockquote>{children}</blockquote>
      {cite && <figcaption>— {cite}</figcaption>}
    </figure>
  )
}

/* ---------------------------------------------------------- founder stuff */

export function Stats({ children }: { children: ReactNode }) {
  return <div className="b-stats">{children}</div>
}

export function Stat({ value, label, note, trend }: { value: string; label: string; note?: string; trend?: 'up' | 'down' }) {
  return (
    <div className="b-stat">
      <span className="b-stat__value">
        {value}
        {trend && <span className={`b-stat__trend is-${trend}`}>{trend === 'up' ? '↑' : '↓'}</span>}
      </span>
      <span className="b-stat__label">{label}</span>
      {note && <span className="b-stat__note">{note}</span>}
    </div>
  )
}

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="b-timeline">{children}</ol>
}

export function Event({ date, title, children }: { date: string; title: string; children?: ReactNode }) {
  return (
    <li className="b-event">
      <span className="b-event__date">{date}</span>
      <p className="b-event__title">{title}</p>
      {children && <div className="b-event__body">{children}</div>}
    </li>
  )
}

/** Architecture/strategy decision record (ADR): context → decision → consequences. */
export function Decision({ title, status = 'Accepted', date, children }: { title: string; status?: 'Proposed' | 'Accepted' | 'Superseded' | 'Rejected'; date?: string; children: ReactNode }) {
  return (
    <section className="b-decision">
      <header>
        <span className="b-kicker">Decision{date ? ` · ${date}` : ''}</span>
        <span className={`b-decision__status is-${status.toLowerCase()}`}>{status}</span>
      </header>
      <p className="b-decision__title">{title}</p>
      <div className="b-decision__body">{children}</div>
    </section>
  )
}

export function ProsCons({ pros, cons, title }: { pros: string[]; cons: string[]; title?: string }) {
  return (
    <section className="b-proscons" aria-label={title ?? 'Pros and cons'}>
      {title && <p className="b-proscons__title">{title}</p>}
      <div>
        <p className="b-kicker is-pro">Pros</p>
        <ul>
          {pros.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="b-kicker is-con">Cons</p>
        <ul>
          {cons.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* --------------------------------------------------------- engineer stuff */

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="b-steps">{children}</ol>
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="b-step">
      <p className="b-step__title">{title}</p>
      <div>{children}</div>
    </li>
  )
}

export function Tab({ children }: { label: string; children: ReactNode }) {
  return <>{children}</>
}

export function Tabs({ children }: { children: ReactNode }) {
  const tabs = Children.toArray(children).filter(isValidElement) as ReactElement<{ label: string; children: ReactNode }>[]
  const [i, setI] = useState(0)
  const id = useId()
  const isStatic = useContext(StaticContext)
  if (isStatic)
    return (
      <>
        {tabs.map((t) => (
          <div key={t.props.label}>
            <p>
              <strong>{t.props.label}</strong>
            </p>
            {t.props.children}
          </div>
        ))}
      </>
    )
  const focusTab = (k: number) => {
    setI(k)
    requestAnimationFrame(() => document.getElementById(`${id}-t${k}`)?.focus())
  }
  return (
    <div className="b-tabs">
      <div className="b-tabs__list" role="tablist" aria-label="Choose a variant">
        {tabs.map((t, k) => (
          <button
            key={t.props.label}
            role="tab"
            id={`${id}-t${k}`}
            aria-selected={i === k}
            aria-controls={`${id}-p${k}`}
            tabIndex={i === k ? 0 : -1}
            onClick={() => setI(k)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') focusTab((k + 1) % tabs.length)
              if (e.key === 'ArrowLeft') focusTab((k - 1 + tabs.length) % tabs.length)
              if (e.key === 'Home') focusTab(0)
              if (e.key === 'End') focusTab(tabs.length - 1)
            }}
          >
            {t.props.label}
          </button>
        ))}
      </div>
      {tabs.map((t, k) => (
        <div key={t.props.label} role="tabpanel" id={`${id}-p${k}`} aria-labelledby={`${id}-t${k}`} hidden={i !== k} className="b-tabs__panel" tabIndex={0}>
          {t.props.children}
        </div>
      ))}
    </div>
  )
}

export function FileTree({ children }: { children: ReactNode }) {
  return <div className="b-filetree">{children}</div>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="b-kbd">{children}</kbd>
}

/* --------------------------------------------------------- research stuff */

export function Cite({ id }: { id: string }) {
  const post = useContext(PostContext)
  const refs = post?.references ?? []
  const n = refs.findIndex((r) => r.id === id) + 1
  const ref = refs[n - 1]
  return (
    <sup className="b-cite">
      <a href={`#ref-${id}`} title={ref ? `${ref.authors ? ref.authors + ', ' : ''}${ref.title}${ref.year ? ` (${ref.year})` : ''}` : id}>
        [{n || '?'}]
      </a>
    </sup>
  )
}

export function References() {
  const post = useContext(PostContext)
  const refs = post?.references ?? []
  if (!refs.length) return null
  return (
    <section className="b-refs" aria-labelledby="references">
      <h2 id="references">References</h2>
      <ol>
        {refs.map((r) => (
          <li key={r.id} id={`ref-${r.id}`}>
            {r.authors && <span>{r.authors.replace(/\.$/, '')}. </span>}
            {r.url || r.doi ? (
              <a href={r.url ?? `https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer" className="b-ext">
                {r.title}
              </a>
            ) : (
              <em>{r.title}</em>
            )}
            {r.venue && <span>. {r.venue}</span>}
            {r.year && <span>, {r.year}</span>}.
            {r.doi && (
              <>
                {' '}
                <a href={`https://doi.org/${r.doi}`} className="b-refs__doi" target="_blank" rel="noopener noreferrer">
                  https://doi.org/{r.doi}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export function BarChart({ title, data, unit = '', max, caption }: { title: string; data: { label: string; value: number; note?: string }[]; unit?: string; max?: number; caption?: ReactNode }) {
  const top = max ?? Math.max(...data.map((d) => d.value))
  return (
    <figure className="b-figure b-chart">
      <p className="b-chart__title">{title}</p>
      <div role="list">
        {data.map((d) => (
          <div className="b-chart__row" role="listitem" key={d.label} aria-label={`${d.label}: ${d.value}${unit}`}>
            <span className="b-chart__label">{d.label}</span>
            <span className="b-chart__track">
              <span className="b-chart__bar" style={{ width: `${(d.value / top) * 100}%` }} />
            </span>
            <span className="b-chart__value">
              {d.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/** A left-to-right pipeline diagram (wraps on small screens). */
export function Flow({ steps, caption }: { steps: (string | { label: string; note?: string })[]; caption?: ReactNode }) {
  return (
    <figure className="b-figure b-flow">
      <ol>
        {steps.map((s, i) => {
          const st = typeof s === 'string' ? { label: s } : s
          return (
            <li key={i}>
              <span className="b-flow__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="b-flow__label">{st.label}</span>
              {st.note && <span className="b-flow__note">{st.note}</span>}
            </li>
          )
        })}
      </ol>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/* ---------------------------------------------------------- writer stuff */

/** Margin note on wide screens; tap-to-open inline note on phones. */
export function Sidenote({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className={`b-sidenote ${open ? 'is-open' : ''}`}>
      <button className="b-sidenote__mark" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} aria-label="Side note">
        ※
      </button>
      <span className="b-sidenote__body" id={id} role="note">
        {children}
      </span>
    </span>
  )
}

/** Inline glossary term with a definition on hover / focus / tap. */
export function Term({ def, children }: { def: string; children: ReactNode }) {
  return (
    <span className="b-term" tabIndex={0} data-def={def} aria-label={`${typeof children === 'string' ? children : ''}: ${def}`}>
      {children}
    </span>
  )
}

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="b-details">
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  )
}

export function LinkCard({ href, title, description, label }: { href: string; title: string; description?: string; label?: string }) {
  let host = ''
  try {
    host = href.startsWith('/') ? 'gulzaib' : new URL(href).host.replace(/^www\./, '')
  } catch {
    /* relative */
  }
  return (
    <A href={href}>
      <span className="b-linkcard">
        <span className="b-kicker">{label ?? host}</span>
        <span className="b-linkcard__title">{title}</span>
        {description && <span className="b-linkcard__desc">{description}</span>}
      </span>
    </A>
  )
}

/** Card linking to another post on this blog. */
export function PostLink({ slug }: { slug: string }) {
  const p = getPost(slug)
  if (!p) return null
  return (
    <Link href={postUrl(p)} className="b-postlink">
      <CoverArt art={p.art} seed={p.slug} color={CATEGORY_COLOR[p.category]} />
      <span>
        <span className="b-kicker">
          {p.category} · {p.minutes} min read
        </span>
        <span className="b-postlink__title">{p.title}</span>
        <span className="b-postlink__desc">{p.description}</span>
      </span>
    </Link>
  )
}

/** Frequently asked questions (from frontmatter `faq`), also emitted as FAQPage structured data. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  if (!items.length) return null
  return (
    <section className="b-faq" aria-labelledby="faq">
      <h2 id="faq">Questions readers ask</h2>
      {items.map((f) => (
        <details key={f.q} className="b-details">
          <summary>{f.q}</summary>
          <div>
            <p>{f.a}</p>
          </div>
        </details>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------------- map */

export const mdxComponents = {
  h2: (p: ComponentProps<'h2'>) => <Heading as="h2" {...p} />,
  h3: (p: ComponentProps<'h3'>) => <Heading as="h3" {...p} />,
  h4: (p: ComponentProps<'h4'>) => <Heading as="h4" {...p} />,
  a: A,
  pre: Pre,
  img: Img,
  table: Table,
  Callout,
  TLDR,
  Takeaways,
  Abstract,
  Update,
  PullQuote,
  Stats,
  Stat,
  Timeline,
  Event,
  Decision,
  ProsCons,
  Steps,
  Step,
  Tabs,
  Tab,
  FileTree,
  Kbd,
  Cite,
  // references render automatically at the end of a post; the tag is accepted but not needed
  References: () => null,
  BarChart,
  Flow,
  Sidenote,
  Term,
  Details,
  Figure,
  YouTube,
  LinkCard,
  PostLink,
}
