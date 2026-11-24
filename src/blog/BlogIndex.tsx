import { useEffect, useMemo, useRef } from 'react'
import { Link, navigate, useHashScroll, useLocation } from './router'
import { allSeries, allTags, CATEGORIES, CATEGORY_COLOR, featuredPost, formatDate, postUrl, posts, type Category, type PostMeta } from './data'
import { CoverArt } from './components/CoverArt'
import { Newsletter } from './components/layout'
import { Icon } from './components/ui'

export function PostCard({ p, big }: { p: PostMeta; big?: boolean }) {
  return (
    <article className={`b-card ${big ? 'is-big' : ''}`} style={{ ['--cat' as string]: CATEGORY_COLOR[p.category] }}>
      <Link href={postUrl(p)} className="b-card__link" aria-label={p.title}>
        <span className="b-card__art">
          <CoverArt art={p.art} seed={p.slug} color={CATEGORY_COLOR[p.category]} />
        </span>
      </Link>
      <div className="b-card__body">
        <p className="b-meta">
          <span className="b-cat">{p.category}</span>
          <span>{formatDate(p.date, 'short')}</span>
          <span>{p.minutes} min read</span>
          {p.draft && <span className="b-draft">Draft</span>}
        </p>
        <h3 className="b-card__title">
          <Link href={postUrl(p)}>{p.title}</Link>
        </h3>
        <p className="b-card__desc">{p.description}</p>
        {p.series && (
          <p className="b-card__series">
            Series · {p.series}
            {p.seriesPart ? `, part ${p.seriesPart}` : ''}
          </p>
        )}
      </div>
    </article>
  )
}

function matches(p: PostMeta, q: string) {
  if (!q) return true
  const hay = `${p.title} ${p.description} ${p.category} ${p.tags.join(' ')} ${p.series ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}

export default function BlogIndex() {
  const { search, hash } = useLocation()
  const q = search.get('q') ?? ''
  const tag = search.get('tag') ?? ''
  const cat = (search.get('category') ?? '') as Category | ''
  const input = useRef<HTMLInputElement>(null)
  useHashScroll(hash)

  useEffect(() => {
    document.title = 'Notebook · Muhammad Gulzaib'
    if (search.get('focus') === 'search') {
      input.current?.focus()
      input.current?.scrollIntoView({ block: 'center' })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [search])

  const setParam = (k: string, v: string) => {
    const s = new URLSearchParams(search)
    if (v) s.set(k, v)
    else s.delete(k)
    s.delete('focus')
    const str = s.toString()
    navigate(`/blog${str ? `?${str}` : ''}`, { replace: k === 'q', keepScroll: true })
  }

  const filtered = useMemo(() => posts.filter((p) => matches(p, q) && (!tag || p.tags.includes(tag)) && (!cat || p.category === cat)), [q, tag, cat])
  const filtering = !!(q || tag || cat)
  const featured = featuredPost()
  const list = filtering ? filtered : filtered.filter((p) => p !== featured)
  const byYear = list.reduce<Record<string, PostMeta[]>>((acc, p) => ((acc[p.date.slice(0, 4)] ||= []).push(p), acc), {})
  const series = allSeries()
  const tags = allTags()

  return (
    <main id="main" className="b-index">
      <section className="b-hero">
        <p className="b-kicker">Notebook · {posts.length} posts</p>
        <h1>Notes on building companies, shipping software and thinking with AI.</h1>
        <p className="b-lede">
          I’m Gul, a founder and full stack engineer. I write down what I learn turning code into products: the founder lessons that cost me something, engineering deep dives, AI systems research, and how to explain technical
          work clearly.
        </p>
        <div className="b-hero__actions">
          <a className="b-btn" href="#subscribe">
            Subscribe
          </a>
          <a className="b-btn is-ghost" href="/rss.xml">
            <Icon name="rss" size={16} /> RSS
          </a>
        </div>
      </section>

      <section className="b-filters" aria-label="Find a post">
        <div className="b-search">
          <Icon name="search" />
          <label htmlFor="b-q" className="sr-only">
            Search posts
          </label>
          <input id="b-q" ref={input} type="search" placeholder="Search posts, topics, series…" value={q} onChange={(e) => setParam('q', e.target.value)} autoComplete="off" />
          <kbd className="b-kbd">/</kbd>
        </div>
        <div className="b-chips" role="group" aria-label="Filter by category">
          <button className={!cat ? 'is-on' : ''} aria-pressed={!cat} onClick={() => setParam('category', '')}>
            All <span>{posts.length}</span>
          </button>
          {CATEGORIES.map((c) => {
            const n = posts.filter((p) => p.category === c.id).length
            return (
              <button key={c.id} className={cat === c.id ? 'is-on' : ''} aria-pressed={cat === c.id} onClick={() => setParam('category', cat === c.id ? '' : c.id)} style={{ ['--cat' as string]: CATEGORY_COLOR[c.id] }}>
                <i aria-hidden="true" /> {c.id} <span>{n}</span>
              </button>
            )
          })}
        </div>
        {tag && (
          <p className="b-active-tag">
            Tagged <strong>#{tag}</strong>
            <button onClick={() => setParam('tag', '')} aria-label={`Clear tag ${tag}`}>
              <Icon name="close" size={14} />
            </button>
          </p>
        )}
      </section>

      {!filtering && featured && (
        <section className="b-featured" aria-label="Featured post">
          <p className="b-section-title">Start here</p>
          <PostCard p={featured} big />
        </section>
      )}

      <section className="b-list" aria-label="All posts" aria-live="polite">
        {filtering && (
          <p className="b-section-title">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </p>
        )}
        {filtered.length === 0 && (
          <div className="b-empty">
            <p>No posts match that yet.</p>
            <button className="b-btn is-ghost" onClick={() => navigate('/blog', { keepScroll: true })}>
              Clear filters
            </button>
          </div>
        )}
        {Object.entries(byYear)
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([year, ps]) => (
            <div key={year} className="b-year">
              {!filtering && <p className="b-section-title">{year}</p>}
              <div className="b-grid">
                {ps.map((p) => (
                  <PostCard key={p.slug} p={p} />
                ))}
              </div>
            </div>
          ))}
      </section>

      {!filtering && series.length > 0 && (
        <section className="b-series-list" aria-labelledby="series-title">
          <p className="b-section-title" id="series-title">
            Series
          </p>
          {series.map((s) => (
            <div className="b-series-card" key={s.name}>
              <p className="b-series-card__name">{s.name}</p>
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
        </section>
      )}

      {!filtering && (
        <section className="b-audiences" aria-labelledby="for-title">
          <p className="b-section-title" id="for-title">
            Who it’s for
          </p>
          <div className="b-audiences__grid">
            {CATEGORIES.map((c) => (
              <button key={c.id} className="b-audience" style={{ ['--cat' as string]: CATEGORY_COLOR[c.id] }} onClick={() => setParam('category', c.id)}>
                <span className="b-audience__name">
                  {{ Founder: 'Founders', Engineering: 'Engineers', 'AI Research': 'AI researchers', Writing: 'Technical writers' }[c.id]}
                </span>
                <span className="b-audience__blurb">{c.blurb}</span>
                <span className="b-audience__go">
                  {c.id} posts <Icon name="arrow" size={14} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="b-topics" id="topics" aria-labelledby="topics-title">
        <p className="b-section-title" id="topics-title">
          Topics
        </p>
        <div className="b-tags">
          {tags.map(([t, n]) => (
            <button key={t} className={tag === t ? 'is-on' : ''} onClick={() => setParam('tag', tag === t ? '' : t)}>
              #{t} <span>{n}</span>
            </button>
          ))}
        </div>
      </section>

      <div id="subscribe">
        <Newsletter />
      </div>
    </main>
  )
}
