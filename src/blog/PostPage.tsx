import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, navigate, useHashScroll } from './router'
import { audienceLower, CATEGORIES, CATEGORY_COLOR, formatDate, getPost, neighbours, postUrl, posts, related, seriesOf, SITE_URL, type PostMeta } from './data'
import { getBody, loadBody, type Body } from './content'
import { CoverArt } from './components/CoverArt'
import { Faq, mdxComponents, PostContext, References } from './components/mdx'
import { AuthorCard, isTypingEvent, Newsletter } from './components/layout'
import { Reactions } from './components/reactions'
import { Listen, toggleListen } from './components/listen'
import { copy, dismissToast, Icon, toast } from './components/ui'
import { PostCard } from './BlogIndex'
import { setProgress, toggleSaved, useReader } from './store'
import { reduceMotion } from './prefs'
import { useHydrated } from './hydrated'
import { ArticleInfo, CiteThis, clearScholarMeta, LicenseBadge, OrcidLink, syncScholarMeta } from './components/scholar'

/** Keep <head> in sync on client-side navigation (pre-rendered pages already have it). */
function setMeta(p: PostMeta) {
  document.title = `${p.title} · Gul’s Notebook`
  const set = (sel: string, attr: string, val: string) => {
    let el = document.head.querySelector(sel)
    if (!el) {
      el = document.createElement(sel.startsWith('link') ? 'link' : 'meta')
      const [, k, v] = sel.match(/\[([\w:]+)="([^"]+)"\]/)!
      el.setAttribute(k, v)
      document.head.appendChild(el)
    }
    el.setAttribute(attr, val)
  }
  const url = `${SITE_URL}/blog/${p.slug}`
  set('meta[name="description"]', 'content', p.description)
  set('link[rel="canonical"]', 'href', url)
  set('meta[property="og:title"]', 'content', p.title)
  set('meta[property="og:description"]', 'content', p.description)
  set('meta[property="og:url"]', 'content', url)
  set('meta[property="og:image"]', 'content', `${SITE_URL}/og/${p.slug}.png`)
}

/** 0..1 of the article read, measured so the last screen counts as "done". */
function readFraction(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight * 0.6
  return Math.min(1, Math.max(0, -r.top / Math.max(1, total)))
}
function scrollToFraction(el: HTMLElement, p: number) {
  const top = el.getBoundingClientRect().top + window.scrollY
  const total = el.offsetHeight - window.innerHeight * 0.6
  window.scrollTo({ top: top + total * p, behavior: reduceMotion() ? 'auto' : 'smooth' })
}

/* -------------------------------------------------------------- progress */

function Progress({ target, p }: { target: React.RefObject<HTMLElement | null>; p: PostMeta }) {
  const bar = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(p.minutes)
  useEffect(() => {
    let raf = 0
    let saveT = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = target.current
        if (!el || !bar.current) return
        const f = readFraction(el)
        bar.current.style.transform = `scaleX(${f})`
        setLeft(Math.max(0, Math.ceil(p.minutes * (1 - f))))
        // remember where the reader is (throttled), so they can resume later
        clearTimeout(saveT)
        saveT = window.setTimeout(() => f > 0.02 && setProgress(p.slug, { p: Math.round(f * 1000) / 1000, y: Math.round(window.scrollY) }), 400)
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      clearTimeout(saveT)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [target, p])
  return (
    <div className="b-progress" aria-hidden="true">
      <div ref={bar} />
      <span className="b-progress__left">{left > 0 ? `${left} min left` : 'Finished'}</span>
    </div>
  )
}

/* -------------------------------------------------------------------- toc */

function useActiveHeading(ids: string[], ready: boolean) {
  const [active, setActive] = useState('')
  useEffect(() => {
    if (!ready) return
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [ids, ready])
  return active
}

function Toc({ heads, active, id }: { heads: PostMeta['headings']; active: string; id: string }) {
  if (heads.length < 2) return null
  const go = (e: React.MouseEvent, hid: string) => {
    const el = document.getElementById(hid)
    if (!el) return
    e.preventDefault()
    history.replaceState(null, '', `#${hid}`)
    el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }
  return (
    <nav className="b-toc" aria-labelledby={id}>
      <p className="b-kicker" id={id}>
        On this page
      </p>
      <ol>
        {heads.map((h) => (
          <li key={h.id} className={`is-h${h.depth} ${active === h.id ? 'is-active' : ''}`}>
            <a href={`#${h.id}`} onClick={(e) => go(e, h.id)} aria-current={active === h.id ? 'location' : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/* ----------------------------------------------------------------- pieces */

function SeriesBox({ p }: { p: PostMeta }) {
  const list = seriesOf(p)
  const { progress } = useReader()
  const hydrated = useHydrated()
  if (list.length < 2) return null
  const i = list.findIndex((q) => q.slug === p.slug)
  return (
    <nav className="b-series" aria-labelledby="series-name" data-preview="hover">
      <p className="b-kicker">
        Series · part {p.seriesPart ?? i + 1} of {list.length}
      </p>
      <p className="b-series__name" id="series-name">
        {p.series}
      </p>
      <ol>
        {list.map((q) => (
          <li key={q.slug} className={`${q.slug === p.slug ? 'is-current' : ''} ${hydrated && progress[q.slug]?.done ? 'is-done' : ''}`}>
            {q.slug === p.slug ? <span aria-current="page">{q.title}</span> : <Link href={postUrl(q)}>{q.title}</Link>}
            {hydrated && progress[q.slug]?.done && <span className="sr-only"> (read)</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function NextInSeries({ p }: { p: PostMeta }) {
  const list = seriesOf(p)
  const next = list[list.findIndex((q) => q.slug === p.slug) + 1]
  if (!next) return null
  return (
    <Link href={postUrl(next)} className="b-nextpart" style={{ ['--cat' as string]: CATEGORY_COLOR[next.category] }}>
      <span className="b-kicker">
        Next in “{p.series}” · part {next.seriesPart ?? list.indexOf(next) + 1}
      </span>
      <span className="b-nextpart__title">{next.title}</span>
      <span className="b-nextpart__desc">{next.description}</span>
      <span className="b-nextpart__go">
        Continue the series · {next.minutes} min <Icon name="arrow" size={15} />
      </span>
    </Link>
  )
}

function Share({ p }: { p: PostMeta }) {
  const url = `${SITE_URL}/blog/${p.slug}`
  const text = encodeURIComponent(p.title)
  const [native, setNative] = useState(false)
  useEffect(() => setNative('share' in navigator), [])
  return (
    <div className="b-share" role="group" aria-labelledby="share-title">
      <h2 className="b-kicker" id="share-title">
        Share this post
      </h2>
      <div className="b-share__btns">
        <button type="button" onClick={() => copy(url, 'Link copied')}>
          <Icon name="link" size={16} /> Copy link
        </button>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
          <Icon name="linkedin" size={16} /> LinkedIn<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={`https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
          <Icon name="x" size={14} /> X<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`} target="_blank" rel="noopener noreferrer">
          <Icon name="whatsapp" size={16} /> WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={`mailto:?subject=${text}&body=${encodeURIComponent(`${p.description}\n\n${url}`)}`}>
          <Icon name="mail" size={16} /> Email
        </a>
        {native && (
          <button type="button" onClick={() => navigator.share({ title: p.title, text: p.description, url }).catch(() => {})}>
            <Icon name="share" size={16} /> More…
          </button>
        )}
      </div>
    </div>
  )
}

function PrevNext({ p }: { p: PostMeta }) {
  const { newer, older } = neighbours(p)
  if (!newer && !older) return null
  return (
    <nav className="b-prevnext" aria-label="Older and newer posts" data-preview="hover">
      {older ? (
        <Link href={postUrl(older)} className="is-prev" rel="prev">
          <span className="b-kicker">← Older</span>
          <span>{older.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {newer && (
        <Link href={postUrl(newer)} className="is-next" rel="next">
          <span className="b-kicker">Newer →</span>
          <span>{newer.title}</span>
        </Link>
      )}
    </nav>
  )
}

function Actions({ p, prose }: { p: PostMeta; prose: React.RefObject<HTMLElement | null> }) {
  const { saved } = useReader()
  const hydrated = useHydrated()
  const isSaved = hydrated && saved.includes(p.slug)
  return (
    <div className="b-actions" role="toolbar" aria-label="Post actions">
      <button
        type="button"
        className={`b-action ${isSaved ? 'is-on' : ''}`}
        aria-pressed={isSaved}
        onClick={() => toast(toggleSaved(p.slug) ? 'Saved. Find it under “Saved” on the blog home.' : 'Removed from saved')}
        title="Save for later (s)"
      >
        <Icon name="bookmark" size={16} filled={isSaved} />
        <span>{isSaved ? 'Saved' : 'Save'}</span>
      </button>
      <Listen root={prose} />
      <button type="button" className="b-action" onClick={() => toggleFocus()} title="Focus mode (f)">
        <Icon name="focus" size={16} />
        <span>Focus</span>
      </button>
      <button type="button" className="b-action" onClick={() => copy(`${SITE_URL}/blog/${p.slug}`, 'Link copied')} title="Copy link">
        <Icon name="link" size={16} />
        <span>Copy link</span>
      </button>
      <a className="b-action" href={`/blog/${p.slug}.md`} title="Plain Markdown version, for note apps and AI tools">
        <Icon name="markdown" size={16} />
        <span>Markdown</span>
      </a>
      <a className="b-action" href={`/blog/${p.slug}.pdf`} title="PDF version, to save, print or cite">
        <Icon name="pdf" size={16} />
        <span>PDF</span>
      </a>
    </div>
  )
}

function toggleFocus(force?: boolean) {
  const el = document.documentElement
  const on = force ?? el.dataset.focus !== '1'
  if (on) el.dataset.focus = '1'
  else delete el.dataset.focus
  if (on) toast('Focus mode on. Press F or Esc to exit.', { ms: 2600 })
}

/* ------------------------------------------------------------------- page */

export default function PostPage({ slug }: { slug: string }) {
  const p = getPost(slug)
  const [Content, setContent] = useState<Body | undefined>(() => getBody(slug))
  const [failed, setFailed] = useState(false)
  const article = useRef<HTMLElement>(null)
  const prose = useRef<HTMLDivElement>(null)
  const heads = p?.headings ?? []
  const ids = useRef(heads.map((h) => h.id)).current
  const active = useActiveHeading(ids, !!Content)
  useHashScroll(Content)

  // bibliographic tags belong to this post only (Zotero reads the live <head>)
  useEffect(() => clearScholarMeta, [])
  useEffect(() => {
    if (!p) return
    setMeta(p)
    syncScholarMeta(p)
    if (getBody(slug)) return
    let alive = true
    loadBody(slug)
      .then((b) => alive && (b ? setContent(() => b) : setFailed(true)))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [slug, p])

  // offer to resume a half-read post
  useEffect(() => {
    if (!p || !Content || location.hash) return
    let saved: { p: number } | undefined
    try {
      saved = JSON.parse(localStorage.getItem('gul:blog-reader') || '{}').progress?.[p.slug]
    } catch {
      /* ignore */
    }
    if (!saved || saved.p < 0.08 || saved.p > 0.9) return
    const t = setTimeout(
      () =>
        toast(`You read ${Math.round(saved!.p * 100)}% of this post.`, {
          action: { label: 'Resume', run: () => article.current && scrollToFraction(article.current, saved!.p) },
        }),
      700,
    )
    return () => {
      clearTimeout(t)
      dismissToast()
    }
  }, [p, Content])

  // post shortcuts: j/k sections, s save, f focus, l listen, Esc leaves focus mode
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!p || isTypingEvent(e) || e.defaultPrevented) return
      if (e.key === 'Escape' && document.documentElement.dataset.focus === '1') return toggleFocus(false)
      if (e.key === 'f') return toggleFocus()
      if (e.key === 's') return toast(toggleSaved(p.slug) ? 'Saved for later' : 'Removed from saved')
      if (e.key === 'l') return toggleListen()
      if (e.key === 'j' || e.key === 'k') {
        const els = heads.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[]
        const y = 100
        const cur = els.findIndex((el) => el.getBoundingClientRect().top > y + 4)
        const target = e.key === 'j' ? els[cur === -1 ? els.length : cur] : els[(cur === -1 ? els.length : cur) - 2] ?? (window.scrollY > 0 ? article.current : undefined)
        if (target) {
          target.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' })
          if (target.tagName.startsWith('H')) target.focus({ preventScroll: true })
        }
      }
    },
    [p, heads],
  )
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      delete document.documentElement.dataset.focus
    }
  }, [onKey])

  if (!p || failed) return <NotFound />
  const rel = related(p)
  const color = CATEGORY_COLOR[p.category]
  const audience = CATEGORIES.find((c) => c.id === p.category)?.audience

  return (
    <PostContext.Provider value={p}>
      <Progress target={article} p={p} />
      <main id="main" className="b-post" style={{ ['--cat' as string]: color }} tabIndex={-1}>
        <article ref={article} className="b-article" aria-labelledby="post-title">
          <header className="b-post__head">
            <nav aria-label="Breadcrumb" data-preview="hover">
              <ol className="b-crumbs">
                <li>
                  <Link href="/blog">Notebook</Link>
                </li>
                <li>
                  <Link href={`/blog?category=${encodeURIComponent(p.category)}`}>{p.category}</Link>
                </li>
                <li className="sr-only">
                  <span aria-current="page">{p.title}</span>
                </li>
              </ol>
            </nav>
            <h1 id="post-title">{p.title}</h1>
            <p className="b-post__dek">{p.description}</p>
            <div className="b-byline">
              <span className="b-author__avatar is-sm" aria-hidden="true">
                <img src="/img/gul/avatar.webp" alt="" width="42" height="42" decoding="async" />
              </span>
              <div>
                <p className="b-byline__name">
                  <a href="/" rel="author">
                    Muhammad Gulzaib
                  </a>
                  <OrcidLink compact />
                </p>
                <p className="b-meta">
                  <span>
                    <span className="sr-only">Published </span>
                    <time dateTime={p.date}>{formatDate(p.date)}</time>
                  </span>
                  {p.updated && (
                    <span className="b-updated">
                      Updated <time dateTime={p.updated}>{formatDate(p.updated)}</time>
                    </span>
                  )}
                  <span>
                    <Icon name="clock" size={13} /> {p.minutes} min read
                  </span>
                  {p.level && <span>{p.level}</span>}
                  {audience && <span>For {audienceLower(audience)}</span>}
                  {p.draft && <span className="b-draft">Draft</span>}
                  <LicenseBadge p={p} />
                </p>
              </div>
            </div>
            <Actions p={p} prose={prose} />
          </header>

          <div className="b-post__cover">
            <CoverArt art={p.art} seed={p.slug} color={color} />
          </div>

          <div className="b-post__grid">
            <aside className="b-post__aside" aria-label="Table of contents">
              <Toc heads={heads} active={active} id="toc-desk" />
            </aside>
            <div className="b-post__main">
              <SeriesBox p={p} />
              {heads.length >= 2 && (
                <details className="b-toc-mobile">
                  <summary>
                    <Icon name="toc" size={16} /> On this page <span className="b-toc-mobile__n">{heads.filter((h) => h.depth === 2).length} sections</span>
                  </summary>
                  <Toc heads={heads} active={active} id="toc-mob" />
                </details>
              )}
              <div className="b-prose" ref={prose}>
                {Content ? <Content components={mdxComponents} /> : <div className="b-skeleton" role="status" aria-label="Loading post" />}
                {Content && <Faq items={p.faq} />}
                {Content && <References />}
              </div>
              {Content && (
                <footer className="b-post__foot">
                  <ul className="b-post__tags" aria-label="Tags">
                    {p.tags.map((t) => (
                      <li key={t}>
                        <Link href={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</Link>
                      </li>
                    ))}
                  </ul>
                  <Reactions slug={p.slug} title={p.title} />
                  <NextInSeries p={p} />
                  <Share p={p} />
                  <ArticleInfo p={p} />
                  <CiteThis p={p} />
                  <p className="b-edit">
                    Spotted a mistake?{' '}
                    <a href={`https://github.com/imgul/my-portfolio/blob/main/src/blog/posts/${p.slug}.mdx`} target="_blank" rel="noopener noreferrer">
                      <Icon name="github" size={15} /> Suggest an edit on GitHub<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                  <AuthorCard />
                  <Newsletter compact />
                  <PrevNext p={p} />
                </footer>
              )}
            </div>
          </div>
        </article>
        {rel.length > 0 && (
          <section className="b-related" aria-labelledby="related-title">
            <h2 className="b-section-title" id="related-title">
              Keep reading
            </h2>
            <div className="b-grid">
              {rel.map((q) => (
                <PostCard key={q.slug} p={q} />
              ))}
            </div>
          </section>
        )}
      </main>
    </PostContext.Provider>
  )
}

export function NotFound() {
  const [q, setQ] = useState('')
  useEffect(() => {
    document.title = 'Page not found · Gul’s Notebook'
  }, [])
  const picks = posts.filter((p) => p.featured).concat(posts.filter((p) => !p.featured)).slice(0, 3)
  return (
    <main id="main" className="b-404" tabIndex={-1}>
      <p className="b-kicker">404 · Page not found</p>
      <h1>This page isn’t written yet.</h1>
      <p className="b-lede">The post may have moved, or the link has a typo. Try a search, or start with one of these.</p>
      <form
        className="b-search is-404"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/blog?q=${encodeURIComponent(q)}`)
        }}
      >
        <Icon name="search" />
        <label htmlFor="nf-q" className="sr-only">
          Search posts
        </label>
        <input id="nf-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts…" />
        <button type="submit" className="b-btn is-sm">
          Search
        </button>
      </form>
      <ul className="b-404__list">
        {picks.map((p) => (
          <li key={p.slug}>
            <Link href={postUrl(p)}>{p.title}</Link>
            <span>
              {p.category} · {p.minutes} min
            </span>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/blog" className="b-btn">
          Browse all posts
        </Link>{' '}
        <a href="/" className="b-btn is-ghost">
          Go to the portfolio
        </a>
      </p>
    </main>
  )
}
