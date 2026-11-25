import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, navigate, useHashScroll, useLocation } from './router'
import { allSeries, allTags, audienceLower, CATEGORIES, CATEGORY_COLOR, featuredPost, formatDate, getPost, postUrl, posts, totalMinutes, type Category, type PostMeta } from './data'
import { PostCover } from './components/PostCover'
import { Newsletter, isTypingEvent } from './components/layout'
import { LikeCount } from './components/reactions'
import { Icon } from './components/ui'
import { prefetchBody } from './content'
import { useCounts } from './reactions'
import { toggleSaved, useReader } from './store'
import { useHydrated } from './hydrated'
import { indexHead, setHead } from './head'

/* ------------------------------------------------------------------ search */

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
const words = (q: string) => norm(q).split(/\s+/).filter(Boolean)

/** Weighted match: title > tags/series > description. Returns 0 for no match. */
function score(p: PostMeta, q: string) {
  const ws = words(q)
  if (!ws.length) return 1
  const title = norm(p.title)
  const meta = norm(`${p.category} ${p.tags.join(' ')} ${p.series ?? ''} ${p.level ?? ''}`)
  const desc = norm(p.description)
  const heads = norm(p.headings.map((h) => h.text).join(' '))
  let s = 0
  for (const w of ws) {
    const t = title.includes(w) ? 6 : meta.includes(w) ? 3 : desc.includes(w) ? 2 : heads.includes(w) ? 1 : 0
    if (!t) return 0
    s += t
  }
  return s
}

/** Highlight query words in a string with <mark>. */
function Hl({ text, q }: { text: string; q: string }) {
  const ws = words(q).filter((w) => w.length > 1)
  if (!ws.length) return <>{text}</>
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  const parts = text.split(re)
  return <>{parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
}

/* -------------------------------------------------------------------- card */

export function PostCard({ p, big, q = '', likes, view = 'grid', headingLevel = 3 }: { p: PostMeta; big?: boolean; q?: string; likes?: number; view?: 'grid' | 'list'; headingLevel?: 2 | 3 }) {
  const { saved, progress } = useReader()
  const hydrated = useHydrated()
  const isSaved = hydrated && saved.includes(p.slug)
  const prog = hydrated ? progress[p.slug] : undefined
  const H = `h${headingLevel}` as 'h2' | 'h3'
  return (
    <article
      data-no-preview=""
      className={`b-card ${big ? 'is-big' : ''} ${view === 'list' && !big ? 'is-row' : ''}`}
      style={{ ['--cat' as string]: CATEGORY_COLOR[p.category] }}
      onPointerEnter={() => prefetchBody(p.slug)}
      onFocus={() => prefetchBody(p.slug)}
    >
      <span className="b-card__art" aria-hidden="true">
        <PostCover p={p} eager={big} sizes={big ? '(max-width: 900px) 100vw, 640px' : view === 'list' ? '220px' : '(max-width: 720px) 100vw, 400px'} />
        {prog?.done ? (
          <span className="b-card__badge">
            <Icon name="check" size={12} /> Read
          </span>
        ) : prog && prog.p > 0.05 ? (
          <span className="b-card__prog" style={{ ['--p' as string]: prog.p }} />
        ) : null}
      </span>
      <div className="b-card__body">
        <p className="b-meta">
          <span className="b-cat">{p.category}</span>
          <time dateTime={p.date}>{formatDate(p.date, 'short')}</time>
          <span>{p.minutes} min read</span>
          {p.draft ? <span className="b-draft">Draft</span> : p.scheduled && <span className="b-draft">Scheduled</span>}
        </p>
        <H className="b-card__title">
          <Link href={postUrl(p)} className="b-card__link">
            <Hl text={p.title} q={q} />
          </Link>
        </H>
        <p className="b-card__desc">
          <Hl text={p.description} q={q} />
        </p>
        <div className="b-card__foot">
          {p.series ? (
            <span className="b-card__series">
              {p.series}
              {p.seriesPart ? ` · part ${p.seriesPart}` : ''}
            </span>
          ) : (
            <span className="b-card__series">{p.level ?? ''}</span>
          )}
          <LikeCount n={likes} />
          <button
            type="button"
            className={`b-card__save ${isSaved ? 'is-on' : ''}`}
            aria-pressed={isSaved}
            aria-label={`${isSaved ? 'Remove from saved' : 'Save for later'}: ${p.title}`}
            title={isSaved ? 'Saved' : 'Save for later'}
            onClick={() => toggleSaved(p.slug)}
          >
            <Icon name="bookmark" size={16} filled={isSaved} />
          </button>
        </div>
      </div>
    </article>
  )
}

/* --------------------------------------------------------------- sections */

function Section({ id, title, kicker, children, action, className = '' }: { id: string; title: string; kicker?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`b-section ${className}`} aria-labelledby={`${id}-title`} id={id}>
      <div className="b-section__head">
        <div>
          {kicker && <p className="b-kicker">{kicker}</p>}
          <h2 className="b-section-title" id={`${id}-title`}>
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ContinueReading() {
  const { progress } = useReader()
  const hydrated = useHydrated()
  if (!hydrated) return null
  const list = Object.entries(progress)
    .filter(([slug, pr]) => !pr.done && pr.p > 0.05 && getPost(slug))
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, 3)
  if (!list.length) return null
  return (
    <Section id="continue" title="Continue reading" kicker="Pick up where you left off">
      <ul className="b-continue">
        {list.map(([slug, pr]) => {
          const p = getPost(slug)!
          const left = Math.max(1, Math.ceil(p.minutes * (1 - pr.p)))
          return (
            <li key={slug} style={{ ['--cat' as string]: CATEGORY_COLOR[p.category] }}>
              <Link href={postUrl(p)} className="b-continue__link">
                <span className="b-continue__title">{p.title}</span>
                <span className="b-continue__meta">
                  {Math.round(pr.p * 100)}% read · {left} min left
                </span>
                <span className="b-continue__bar" role="progressbar" aria-label={`${p.title}: progress`} aria-valuenow={Math.round(pr.p * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${pr.p * 100}%` }} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/* -------------------------------------------------------------------- page */

type Sort = 'new' | 'old' | 'short' | 'liked'
const SORTS: { v: Sort; l: string }[] = [
  { v: 'new', l: 'Newest' },
  { v: 'old', l: 'Oldest' },
  { v: 'short', l: 'Quickest read' },
  { v: 'liked', l: 'Most useful' },
]

export default function BlogIndex() {
  const { search, hash } = useLocation()
  const q = search.get('q') ?? ''
  const tag = search.get('tag') ?? ''
  const cat = (search.get('category') ?? '') as Category | ''
  const savedOnly = search.get('saved') === '1'
  const sort = (search.get('sort') ?? 'new') as Sort
  const input = useRef<HTMLInputElement>(null)
  const { saved } = useReader()
  const hydrated = useHydrated()
  const counts = useCounts(posts.map((p) => p.slug))
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [draft, setDraft] = useState(q)
  useHashScroll(hash)

  useEffect(() => setDraft(q), [q])
  useEffect(() => {
    try {
      const v = localStorage.getItem('gul:blog-view')
      if (v === 'list' || v === 'grid') setView(v)
    } catch {
      /* ignore */
    }
  }, [])
  const changeView = (v: 'grid' | 'list') => {
    setView(v)
    try {
      localStorage.setItem('gul:blog-view', v)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (search.get('focus') === 'search') {
      input.current?.focus()
      input.current?.scrollIntoView({ block: 'center' })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTypingEvent(e)) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [search, savedOnly])

  const setParam = (k: string, v: string) => {
    const s = new URLSearchParams(search)
    if (v) s.set(k, v)
    else s.delete(k)
    s.delete('focus')
    const str = s.toString()
    navigate(`/blog${str ? `?${str}` : ''}`, { replace: k === 'q', keepScroll: true })
  }

  // debounce typing into the URL (keeps history clean, results stay live)
  useEffect(() => {
    if (draft === q) return
    const t = setTimeout(() => setParam('q', draft), 160)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const likes = (slug: string) => counts(slug)?.likes ?? 0
  const filtered = useMemo(() => {
    const list = posts
      .map((p) => ({ p, s: score(p, q) }))
      .filter(({ p, s }) => s > 0 && (!tag || p.tags.includes(tag)) && (!cat || p.category === cat) && (!savedOnly || (hydrated && saved.includes(p.slug))))
    const by: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      new: (a, b) => (q ? b.s - a.s : 0) || (a.p.date < b.p.date ? 1 : -1),
      old: (a, b) => (a.p.date < b.p.date ? -1 : 1),
      short: (a, b) => a.p.minutes - b.p.minutes,
      liked: (a, b) => likes(b.p.slug) - likes(a.p.slug) || (a.p.date < b.p.date ? 1 : -1),
    }
    return list.sort(by[sort] ?? by.new).map((x) => x.p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tag, cat, savedOnly, saved, hydrated, sort, counts])

  const filtering = !!(q || tag || cat || savedOnly || sort !== 'new')
  // the tab title, description and share tags follow the active filter
  useEffect(() => {
    setHead(indexHead({ q, tag, cat, saved: savedOnly, count: filtered.length }))
  }, [q, tag, cat, savedOnly, filtered.length])
  const featured = featuredPost()
  const list = filtering ? filtered : filtered.filter((p) => p !== featured)
  const byYear = list.reduce<Record<string, PostMeta[]>>((acc, p) => ((acc[p.date.slice(0, 4)] ||= []).push(p), acc), {})
  const series = allSeries()
  const tags = allTags()
  const hours = totalMinutes()
  const lastUpdate = posts.map((p) => p.updated ?? p.date).sort().at(-1)
  const resultLabel = `${filtered.length} ${filtered.length === 1 ? 'post' : 'posts'}${q ? ` for “${q}”` : ''}${tag ? ` tagged #${tag}` : ''}${cat ? ` in ${cat}` : ''}${savedOnly ? ' saved' : ''}`

  return (
    <main id="main" className="b-index" tabIndex={-1}>
      <section className="b-hero" aria-labelledby="hero-title">
        <p className="b-kicker">Gul’s Notebook</p>
        <h1 id="hero-title">Notes on building companies, shipping software and thinking with AI.</h1>
        <p className="b-lede">
          I’m Gul, a founder and full stack engineer. I write down what I learn turning code into products: founder lessons that cost me something, engineering deep dives, AI systems research, and how to explain technical
          work clearly.
        </p>
        <ul className="b-hero__stats" aria-label="At a glance">
          <li>
            <strong>{posts.length}</strong> posts
          </li>
          <li>
            <strong>{hours}</strong> minutes of reading
          </li>
          <li>
            <strong>{CATEGORIES.length}</strong> audiences
          </li>
          {lastUpdate && (
            <li>
              Updated <time dateTime={lastUpdate}>{formatDate(lastUpdate, 'short')}</time>
            </li>
          )}
        </ul>
        <div className="b-hero__actions">
          {featured && (
            <Link className="b-btn" href={postUrl(featured)}>
              Start here <Icon name="arrow" size={16} />
            </Link>
          )}
          <a className="b-btn is-ghost" href="#subscribe">
            <Icon name="mail" size={16} /> Subscribe
          </a>
          <a className="b-btn is-ghost" href="/rss.xml">
            <Icon name="rss" size={16} /> RSS
          </a>
        </div>
      </section>

      {!filtering && <ContinueReading />}

      {!filtering && (
        <Section id="paths" title="Pick your path" kicker="Who it’s for">
          <ul className="b-audiences__grid">
            {CATEGORIES.map((c) => {
              const first = posts.filter((p) => p.category === c.id).sort((a, b) => (a.featured ? -1 : b.featured ? 1 : (a.seriesPart ?? 9) - (b.seriesPart ?? 9)))[0]
              const n = posts.filter((p) => p.category === c.id).length
              return (
                <li key={c.id} className="b-audience" style={{ ['--cat' as string]: CATEGORY_COLOR[c.id] }}>
                  <span className="b-audience__glyph" aria-hidden="true">
                    {c.glyph}
                  </span>
                  <h3 className="b-audience__name">For {audienceLower(c.audience)}</h3>
                  <p className="b-audience__blurb">{c.blurb}</p>
                  {first && (
                    <p className="b-audience__first">
                      Start with <Link href={postUrl(first)}>{first.title}</Link>
                    </p>
                  )}
                  <button type="button" className="b-audience__go" onClick={() => setParam('category', c.id)}>
                    All {n} {c.id} {n === 1 ? 'post' : 'posts'} <Icon name="arrow" size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <section className="b-filters" aria-label="Find a post" id="find">
        <form className="b-search" role="search" onSubmit={(e) => (e.preventDefault(), setParam('q', draft))}>
          <Icon name="search" />
          <label htmlFor="b-q" className="sr-only">
            Search posts
          </label>
          <input
            id="b-q"
            ref={input}
            type="search"
            placeholder="Search titles, topics, sections…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setDraft(''), setParam('q', ''))}
            autoComplete="off"
            enterKeyHint="search"
            aria-describedby="b-results"
          />
          <kbd className="b-kbd" aria-hidden="true">
            /
          </kbd>
        </form>
        <div className="b-filters__row">
          <div className="b-chips" role="group" aria-label="Filter by category">
            <button type="button" className={!cat && !savedOnly ? 'is-on' : ''} aria-pressed={!cat && !savedOnly} onClick={() => navigate('/blog' + (q ? `?q=${encodeURIComponent(q)}` : ''), { keepScroll: true })}>
              All <span>{posts.length}</span>
            </button>
            {CATEGORIES.map((c) => {
              const n = posts.filter((p) => p.category === c.id).length
              return (
                <button
                  type="button"
                  key={c.id}
                  className={cat === c.id ? 'is-on' : ''}
                  aria-pressed={cat === c.id}
                  onClick={() => setParam('category', cat === c.id ? '' : c.id)}
                  style={{ ['--cat' as string]: CATEGORY_COLOR[c.id] }}
                >
                  <i aria-hidden="true" /> {c.id} <span>{n}</span>
                </button>
              )
            })}
            <button type="button" className={savedOnly ? 'is-on' : ''} aria-pressed={savedOnly} onClick={() => setParam('saved', savedOnly ? '' : '1')}>
              <Icon name="bookmark" size={13} filled={savedOnly} /> Saved <span>{hydrated ? saved.length : 0}</span>
            </button>
          </div>
          <div className="b-filters__tools">
            <label htmlFor="b-sort" className="sr-only">
              Sort posts
            </label>
            <select id="b-sort" className="b-select" value={sort} onChange={(e) => setParam('sort', e.target.value === 'new' ? '' : e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
            <div className="b-viewtoggle" role="group" aria-label="Layout">
              <button type="button" aria-pressed={view === 'grid'} onClick={() => changeView('grid')} aria-label="Grid view" title="Grid view">
                <Icon name="grid" size={16} />
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')} aria-label="List view" title="List view">
                <Icon name="list" size={16} />
              </button>
            </div>
          </div>
        </div>
        {tag && (
          <p className="b-active-tag">
            Tagged <strong>#{tag}</strong>
            <button type="button" onClick={() => setParam('tag', '')} aria-label={`Clear tag ${tag}`}>
              <Icon name="close" size={14} />
            </button>
          </p>
        )}
        <p id="b-results" className={filtering ? 'b-results' : 'sr-only'} role="status" aria-live="polite">
          {filtering ? resultLabel : ''}
        </p>
      </section>

      {!filtering && featured && (
        <section className="b-featured" aria-labelledby="featured-title">
          <h2 className="b-section-title" id="featured-title">
            Start here
          </h2>
          <PostCard p={featured} big likes={likes(featured.slug)} />
        </section>
      )}

      <section className="b-list" aria-labelledby="list-title">
        <h2 className={filtering ? 'sr-only' : 'b-section-title'} id="list-title">
          {filtering ? 'Results' : 'All writing'}
        </h2>
        {filtered.length === 0 && (
          <div className="b-empty">
            {savedOnly && !saved.length ? (
              <p>Nothing saved yet. Press the bookmark on any post to keep it here (on this device).</p>
            ) : (
              <p>No posts match that yet. Try fewer words, or a broader topic.</p>
            )}
            <button type="button" className="b-btn is-ghost" onClick={() => navigate('/blog', { keepScroll: true })}>
              Clear filters
            </button>
          </div>
        )}
        {filtering ? (
          <div className={`b-grid ${view === 'list' ? 'is-list' : ''}`}>
            {filtered.map((p) => (
              <PostCard key={p.slug} p={p} q={q} likes={likes(p.slug)} view={view} />
            ))}
          </div>
        ) : (
          Object.entries(byYear)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([year, ps]) => (
              <div key={year} className="b-year">
                <h3 className="b-year__label">
                  {year} <span>{ps.length} {ps.length === 1 ? 'post' : 'posts'}</span>
                </h3>
                <div className={`b-grid ${view === 'list' ? 'is-list' : ''}`}>
                  {ps.map((p) => (
                    <PostCard key={p.slug} p={p} likes={likes(p.slug)} view={view} headingLevel={3} />
                  ))}
                </div>
              </div>
            ))
        )}
      </section>

      {!filtering && series.length > 0 && (
        <Section id="series" title="Series" kicker="Read in order">
          <div className="b-series-list">
            {series.map((s) => (
              <div className="b-series-card" key={s.name}>
                <h3 className="b-series-card__name">{s.name}</h3>
                <p className="b-series-card__meta">
                  {s.posts.length} parts · {s.posts.reduce((n, p) => n + p.minutes, 0)} min total
                </p>
                <ol>
                  {s.posts.map((p) => (
                    <li key={p.slug}>
                      <Link href={postUrl(p)}>{p.title}</Link>
                      <span>{p.minutes} min</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section id="topics" title="Topics" kicker="Browse by tag">
        <ul className="b-tags">
          {tags.map(([t, n]) => (
            <li key={t}>
              <button type="button" className={tag === t ? 'is-on' : ''} aria-pressed={tag === t} onClick={() => setParam('tag', tag === t ? '' : t)}>
                #{t} <span aria-label={`${n} posts`}>{n}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <div id="subscribe">
        <Newsletter />
      </div>
    </main>
  )
}
