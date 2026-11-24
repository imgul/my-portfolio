import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, useHashScroll } from './router'
import { CATEGORY_COLOR, formatDate, getPost, neighbours, postUrl, related, seriesOf, SITE_URL, type PostMeta } from './data'
import { CoverArt } from './components/CoverArt'
import { mdxComponents, PostContext, References } from './components/mdx'
import { AuthorCard, Newsletter } from './components/layout'
import { copy, Icon } from './components/ui'
import { PostCard } from './BlogIndex'

const loaders = import.meta.glob<{ default: ComponentType<{ components?: Record<string, unknown> }> }>('./posts/*.mdx')

function setMeta(p: PostMeta) {
  document.title = `${p.title} · Gul’s Notebook`
  const set = (sel: string, attr: string, val: string) => {
    let el = document.head.querySelector(sel)
    if (!el) {
      el = document.createElement(sel.startsWith('link') ? 'link' : 'meta')
      const [, k, v] = sel.match(/\[(\w+)="([^"]+)"\]/)!
      el.setAttribute(k, v)
      document.head.appendChild(el)
    }
    el.setAttribute(attr, val)
  }
  set('meta[name="description"]', 'content', p.description)
  set('link[rel="canonical"]', 'href', `${SITE_URL}/blog/${p.slug}`)
}

/* -------------------------------------------------------------- progress */

function Progress({ target, minutes }: { target: React.RefObject<HTMLElement | null>; minutes: number }) {
  const bar = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(minutes)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = target.current
        if (!el || !bar.current) return
        const r = el.getBoundingClientRect()
        const total = r.height - window.innerHeight * 0.6
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)))
        bar.current.style.transform = `scaleX(${p})`
        setLeft(Math.max(0, Math.ceil(minutes * (1 - p))))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [target, minutes])
  return (
    <div className="b-progress" aria-hidden="true">
      <div ref={bar} />
      <span className="b-progress__left">{left > 0 ? `${left} min left` : 'Done reading'}</span>
    </div>
  )
}

/* -------------------------------------------------------------------- toc */

interface Head {
  id: string
  text: string
  level: number
}

function useHeadings(root: React.RefObject<HTMLElement | null>, ready: boolean) {
  const [heads, setHeads] = useState<Head[]>([])
  const [active, setActive] = useState('')
  useEffect(() => {
    if (!ready || !root.current) return
    const els = [...root.current.querySelectorAll<HTMLElement>('h2[id], h3[id]')].filter((h) => !h.classList.contains('sr-only'))
    setHeads(els.map((h) => ({ id: h.id, text: h.textContent?.replace(/#$/, '').trim() ?? '', level: h.tagName === 'H2' ? 2 : 3 })))
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [root, ready])
  return { heads, active }
}

function Toc({ heads, active }: { heads: Head[]; active: string }) {
  if (heads.length < 2) return null
  return (
    <nav className="b-toc" aria-label="On this page">
      <p className="b-kicker">On this page</p>
      <ol>
        {heads.map((h) => (
          <li key={h.id} className={`is-h${h.level} ${active === h.id ? 'is-active' : ''}`}>
            <a href={`#${h.id}`} aria-current={active === h.id ? 'location' : undefined}>
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
  if (list.length < 2) return null
  return (
    <nav className="b-series" aria-label={`Series: ${p.series}`}>
      <p className="b-kicker">
        Series · part {p.seriesPart ?? list.indexOf(p) + 1} of {list.length}
      </p>
      <p className="b-series__name">{p.series}</p>
      <ol>
        {list.map((q) => (
          <li key={q.slug} className={q.slug === p.slug ? 'is-current' : ''}>
            {q.slug === p.slug ? <span aria-current="page">{q.title}</span> : <Link href={postUrl(q)}>{q.title}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Share({ p }: { p: PostMeta }) {
  const url = `${SITE_URL}/blog/${p.slug}`
  const text = encodeURIComponent(p.title)
  const native = typeof navigator !== 'undefined' && 'share' in navigator
  return (
    <div className="b-share" aria-label="Share this post">
      <span className="b-kicker">Share</span>
      <button onClick={() => copy(url, 'Link copied')} aria-label="Copy link">
        <Icon name="link" size={16} /> Copy link
      </button>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
        <Icon name="linkedin" size={16} /> LinkedIn
      </a>
      <a href={`https://x.com/intent/post?text=${text}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X">
        <Icon name="x" size={14} /> X
      </a>
      <a href={`mailto:?subject=${text}&body=${encodeURIComponent(url)}`} aria-label="Share by email">
        <Icon name="mail" size={16} /> Email
      </a>
      {native && (
        <button onClick={() => navigator.share({ title: p.title, url }).catch(() => {})} aria-label="More sharing options">
          More…
        </button>
      )}
    </div>
  )
}

function CiteThis({ p }: { p: PostMeta }) {
  const [fmt, setFmt] = useState<'bibtex' | 'apa'>('bibtex')
  const year = p.date.slice(0, 4)
  const url = `${SITE_URL}/blog/${p.slug}`
  const key = `gulzaib${year}${p.slug.split('-').slice(0, 2).join('')}`
  const text =
    fmt === 'bibtex'
      ? `@misc{${key},\n  author = {Gulzaib, Muhammad},\n  title  = {${p.title}},\n  year   = {${year}},\n  month  = {${new Date(p.date).toLocaleString('en', { month: 'short' }).toLowerCase()}},\n  url    = {${url}},\n  note   = {Gul's Notebook}\n}`
      : `Gulzaib, M. (${year}, ${formatDate(p.date)}). ${p.title}. Gul’s Notebook. ${url}`
  return (
    <details className="b-citethis">
      <summary>
        <Icon name="quote" size={16} /> Cite this post
      </summary>
      <div className="b-citethis__tabs" role="tablist">
        {(['bibtex', 'apa'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={fmt === f} onClick={() => setFmt(f)}>
            {f === 'bibtex' ? 'BibTeX' : 'APA'}
          </button>
        ))}
        <button className="b-citethis__copy" onClick={() => copy(text, 'Citation copied')}>
          <Icon name="copy" size={14} /> Copy
        </button>
      </div>
      <pre>{text}</pre>
    </details>
  )
}

function PrevNext({ p }: { p: PostMeta }) {
  const { newer, older } = neighbours(p)
  if (!newer && !older) return null
  return (
    <nav className="b-prevnext" aria-label="More posts">
      {older ? (
        <Link href={postUrl(older)} className="is-prev">
          <span className="b-kicker">← Older</span>
          <span>{older.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {newer && (
        <Link href={postUrl(newer)} className="is-next">
          <span className="b-kicker">Newer →</span>
          <span>{newer.title}</span>
        </Link>
      )}
    </nav>
  )
}

/* ------------------------------------------------------------------- page */

export default function PostPage({ slug }: { slug: string }) {
  const p = getPost(slug)
  const [Content, setContent] = useState<ComponentType<{ components?: Record<string, unknown> }> | null>(null)
  const [failed, setFailed] = useState(false)
  const article = useRef<HTMLElement>(null)
  const prose = useRef<HTMLDivElement>(null)
  const { heads, active } = useHeadings(prose, !!Content)
  useHashScroll(Content)

  useEffect(() => {
    setContent(null)
    setFailed(false)
    const load = loaders[`./posts/${slug}.mdx`]
    if (!p || !load) return setFailed(true)
    setMeta(p)
    let alive = true
    load()
      .then((m) => alive && setContent(() => m.default))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [slug, p])

  if (!p || failed) return <NotFound />
  const rel = related(p)
  const color = CATEGORY_COLOR[p.category]

  return (
    <PostContext.Provider value={p}>
      <Progress target={article} minutes={p.minutes} />
      <main id="main" className="b-post" style={{ ['--cat' as string]: color }}>
        <article ref={article} className="b-article" aria-labelledby="post-title">
          <header className="b-post__head">
            <nav className="b-crumbs" aria-label="Breadcrumb">
              <Link href="/blog">Notebook</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/blog?category=${encodeURIComponent(p.category)}`}>{p.category}</Link>
            </nav>
            <h1 id="post-title">{p.title}</h1>
            <p className="b-post__dek">{p.description}</p>
            <div className="b-byline">
              <span className="b-author__avatar is-sm" aria-hidden="true">
                MG
              </span>
              <div>
                <p className="b-byline__name">Muhammad Gulzaib</p>
                <p className="b-meta">
                  <time dateTime={p.date}>{formatDate(p.date)}</time>
                  {p.updated && (
                    <span>
                      Updated <time dateTime={p.updated}>{formatDate(p.updated)}</time>
                    </span>
                  )}
                  <span>{p.minutes} min read</span>
                  {p.level && <span>{p.level}</span>}
                  {p.draft && <span className="b-draft">Draft</span>}
                </p>
              </div>
            </div>
            <ul className="b-post__tags" aria-label="Tags">
              {p.tags.map((t) => (
                <li key={t}>
                  <Link href={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</Link>
                </li>
              ))}
            </ul>
          </header>

          <div className="b-post__cover">
            <CoverArt art={p.art} seed={p.slug} color={color} />
          </div>

          <div className="b-post__grid">
            <aside className="b-post__aside">
              <Toc heads={heads} active={active} />
            </aside>
            <div className="b-post__main">
              <SeriesBox p={p} />
              {heads.length >= 2 && (
                <details className="b-toc-mobile">
                  <summary>On this page</summary>
                  <Toc heads={heads} active={active} />
                </details>
              )}
              <div className="b-prose" ref={prose}>
                {Content ? <Content components={mdxComponents} /> : <div className="b-skeleton" aria-label="Loading post" />}
                {Content && <References />}
              </div>
              {Content && (
                <footer className="b-post__foot">
                  <Share p={p} />
                  <CiteThis p={p} />
                  <p className="b-edit">
                    Spotted a mistake?{' '}
                    <a href={`https://github.com/imgul/my-portfolio/blob/main/src/blog/posts/${p.slug}.mdx`} target="_blank" rel="noopener noreferrer">
                      <Icon name="github" size={15} /> Suggest an edit on GitHub
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
            <p className="b-section-title" id="related-title">
              Keep reading
            </p>
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
  useEffect(() => {
    document.title = 'Not found · Gul’s Notebook'
  }, [])
  return (
    <main id="main" className="b-404">
      <p className="b-kicker">404</p>
      <h1>This page isn’t written yet.</h1>
      <p className="b-lede">The post may have moved, or the link has a typo.</p>
      <Link href="/blog" className="b-btn">
        Browse all posts
      </Link>
    </main>
  )
}
