/**
 * Search from anywhere on the blog: the header's search button, "/" or Ctrl/⌘ K open this
 * dialog on top of the current page. Results update as you type, full-text matches link
 * straight to the section that matched, and Enter opens the highlighted result.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CATEGORIES, CATEGORY_COLOR, allTags, formatDate, postUrl, posts, type PostMeta } from '../data'
import { navigate, useLocation } from '../router'
import { Hl, clearRecentSearches, didYouMean, recentSearches, rememberSearch, search, useSearchIndex } from '../search'
import { recordSearchMatches } from '../recommendation-history'
import { useConsent } from '../../lib/consent/consent'
import { PostCover } from './PostCover'
import { Icon } from './ui'

const MAX_POSTS = 6

type Option = { key: string; href: string; kind: 'post' | 'section' | 'all' }

/** Opens the dialog from anywhere (e.g. the 404 page's search form), optionally with a query. */
export function openSearch(q = '') {
  window.dispatchEvent(new CustomEvent('gul:search', { detail: q }))
}

/** After a client-side jump to #id: scroll to it once the post has rendered, and flash it. */
function revealSection(id: string) {
  let tries = 0
  const tick = () => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ block: 'start' })
      el.classList.remove('is-flash')
      void el.offsetWidth
      el.classList.add('is-flash')
      setTimeout(() => el.classList.remove('is-flash'), 2200)
    } else if (tries++ < 40) setTimeout(tick, 50)
  }
  setTimeout(tick, 30)
}

export default function SearchDialog({ open, initial, onClose }: { open: boolean; initial: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const uid = useId()
  const { path } = useLocation()
  const [q, setQ] = useState(initial)
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const consent = useConsent()
  const sections = useSearchIndex(open)

  useEffect(() => {
    if (consent?.choice !== 'all') setRecent([])
  }, [consent])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setQ(initial)
      setActive(0)
      setRecent(recentSearches())
      d.showModal()
      requestAnimationFrame(() => input.current?.select())
    }
    if (!open && d.open) d.close()
  }, [open, initial])

  const query = q.trim()
  const hits = useMemo(() => (query ? search(query, sections) : []), [query, sections])
  const shown = hits.slice(0, MAX_POSTS)
  const suggestion = useMemo(() => (query && !hits.length ? didYouMean(query, sections) : null), [query, hits.length, sections])
  const latest = posts.slice(0, 4)
  const tags = useMemo(() => allTags().slice(0, 10), [])

  // one flat list for the arrow keys: posts, their matching sections, then "see all"
  const options: Option[] = useMemo(() => {
    if (!query) return latest.map((p) => ({ key: p.slug, href: postUrl(p), kind: 'post' as const }))
    const o: Option[] = []
    for (const h of shown) {
      o.push({ key: h.p.slug, href: postUrl(h.p), kind: 'post' })
      for (const s of h.sections) if (s.id) o.push({ key: `${h.p.slug}#${s.id}`, href: `${postUrl(h.p)}#${s.id}`, kind: 'section' })
    }
    if (hits.length) o.push({ key: 'all', href: `/blog?q=${encodeURIComponent(query)}`, kind: 'all' })
    return o
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, hits])
  useEffect(() => setActive(0), [query])
  const optId = (i: number) => `${uid}-o${i}`
  const indexOf = (key: string) => options.findIndex((o) => o.key === key)

  useEffect(() => {
    list.current?.querySelector(`[id="${optId(active)}"]`)?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const go = (o: Option | undefined) => {
    if (!o) return
    if (query) {
      rememberSearch(query)
      recordSearchMatches(hits.filter((h) => !h.p.draft && !h.p.scheduled).map((h) => h.p.slug))
    }
    onClose()
    const [to, id] = o.href.split('#')
    navigate(o.href, { keepScroll: !!id })
    if (id) revealSection(id)
    else if (to === path) window.scrollTo({ top: 0 })
  }

  const onKey = (e: ReactKeyboardEvent) => {
    // a search input swallows the first Esc to clear itself; here Esc always closes
    if (e.key === 'Escape') {
      e.preventDefault()
      return onClose()
    }
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => (options.length ? (a + 1) % options.length : 0))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => (options.length ? (a - 1 + options.length) % options.length : 0))
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!query && !options.length) return
      go(options[active])
    }
  }

  const row = (key: string, children: React.ReactNode, className: string) => {
    const i = indexOf(key)
    const o = options[i]
    return (
      <a
        id={optId(i)}
        role="option"
        aria-selected={i === active}
        href={o?.href}
        className={`${className} ${i === active ? 'is-active' : ''}`}
        onPointerMove={() => i !== active && setActive(i)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          go(o)
        }}
        tabIndex={-1}
      >
        {children}
      </a>
    )
  }

  const postRow = (p: PostMeta) =>
    row(
      p.slug,
      <>
        <span className="b-sd__thumb" aria-hidden="true">
          <PostCover p={p} sizes="96px" />
        </span>
        <span className="b-sd__text">
          <span className="b-sd__title">
            <Hl text={p.title} q={query} />
          </span>
          <span className="b-sd__meta">
            <span className="b-sd__cat" style={{ ['--cat' as string]: CATEGORY_COLOR[p.category] }}>
              {p.category}
            </span>
            <span>{formatDate(p.date, 'short')}</span>
            <span>{p.minutes} min read</span>
          </span>
          {query && (
            <span className="b-sd__desc">
              <Hl text={p.description} q={query} />
            </span>
          )}
        </span>
        <span className="b-sd__go" aria-hidden="true">
          <Icon name="arrow" size={16} />
        </span>
      </>,
      'b-sd__post',
    )

  const status = !query ? '' : hits.length ? `${hits.length} ${hits.length === 1 ? 'post' : 'posts'} found` : 'No posts found'

  return (
    <dialog
      ref={ref}
      className="b-sd"
      aria-label="Search the blog"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="b-sd__bar">
        <Icon name="search" size={20} />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={`${uid}-list`}
          aria-activedescendant={options.length ? optId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search posts"
          placeholder="Search posts, topics, code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {q && (
          <button type="button" className="b-sd__clear" onClick={() => (setQ(''), input.current?.focus())} aria-label="Clear search">
            <Icon name="close" size={14} />
          </button>
        )}
        <button type="button" className="b-sd__esc" onClick={onClose} aria-label="Close search">
          Esc
        </button>
      </div>

      <div className="b-sd__body" ref={list} id={`${uid}-list`} role="listbox" aria-label="Search results">
        {!query ? (
          <>
            {recent.length > 0 && (
              <section className="b-sd__group" role="presentation">
                <p className="b-sd__label">
                  Recent searches
                  <button type="button" className="b-linkbtn" onClick={() => (clearRecentSearches(), setRecent([]))}>
                    Clear
                  </button>
                </p>
                <div className="b-sd__chips" role="presentation">
                  {recent.map((r) => (
                    <button key={r} type="button" className="b-sd__chip" onClick={() => (setQ(r), input.current?.focus())}>
                      <Icon name="clock" size={13} /> {r}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="b-sd__group" role="presentation">
              <p className="b-sd__label">Topics</p>
              <div className="b-sd__chips" role="presentation">
                {CATEGORIES.map((c) => (
                  <a
                    key={c.id}
                    href={`/blog?category=${encodeURIComponent(c.id)}`}
                    className="b-sd__chip"
                    style={{ ['--cat' as string]: CATEGORY_COLOR[c.id] }}
                    onClick={(e) => {
                      e.preventDefault()
                      onClose()
                      navigate(`/blog?category=${encodeURIComponent(c.id)}`)
                    }}
                  >
                    <i className="b-sd__dot" aria-hidden="true" /> {c.id}
                  </a>
                ))}
                {tags.map(([t]) => (
                  <button key={t} type="button" className="b-sd__chip is-tag" onClick={() => (setQ(t), input.current?.focus())}>
                    #{t}
                  </button>
                ))}
              </div>
            </section>
            <section className="b-sd__group" role="presentation">
              <p className="b-sd__label">Latest posts</p>
              {latest.map((p) => (
                <div key={p.slug} role="presentation">
                  {postRow(p)}
                </div>
              ))}
            </section>
          </>
        ) : hits.length ? (
          <>
            {shown.map((h) => (
              <section key={h.p.slug} className="b-sd__hit" role="presentation">
                {postRow(h.p)}
                {h.sections
                  .filter((s) => s.id)
                  .map((s) =>
                    row(
                      `${h.p.slug}#${s.id}`,
                      <>
                        <span className="b-sd__hash" aria-hidden="true">
                          #
                        </span>
                        <span className="b-sd__text">
                          <span className="b-sd__sec">
                            <Hl text={s.h} q={query} />
                          </span>
                          {s.snippet && (
                            <span className="b-sd__snip">
                              <Hl text={s.snippet} q={query} />
                            </span>
                          )}
                        </span>
                      </>,
                      'b-sd__section',
                    ),
                  )}
                {/* intro match (no heading to jump to): show the matching sentence under the post */}
                {h.sections.length > 0 && !h.sections[0].id && h.sections[0].snippet && (
                  <p className="b-sd__intro">
                    <Hl text={h.sections[0].snippet} q={query} />
                  </p>
                )}
              </section>
            ))}
            {row(
              'all',
              <>
                <span>
                  {hits.length > MAX_POSTS ? `See all ${hits.length} results` : 'Show results'} on the blog page for “{query}”
                </span>
                <Icon name="arrow" size={15} />
              </>,
              'b-sd__all',
            )}
          </>
        ) : (
          <div className="b-sd__empty">
            <p>
              No posts match “<strong>{query}</strong>”.
            </p>
            {suggestion && (
              <p>
                Did you mean{' '}
                <button type="button" className="b-linkbtn is-strong" onClick={() => (setQ(suggestion), input.current?.focus())}>
                  {suggestion}
                </button>
                ?
              </p>
            )}
            <p className="b-sd__hint">Try fewer words, or a topic:</p>
            <div className="b-sd__chips">
              {tags.slice(0, 8).map(([t]) => (
                <button key={t} type="button" className="b-sd__chip is-tag" onClick={() => (setQ(t), input.current?.focus())}>
                  #{t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="b-sd__foot" aria-hidden="true">
        <span>
          <kbd className="b-kbd">↑</kbd>
          <kbd className="b-kbd">↓</kbd> to move
        </span>
        <span>
          <kbd className="b-kbd">↵</kbd> to open
        </span>
        <span>
          <kbd className="b-kbd">Esc</kbd> to close
        </span>
        <span className="b-sd__scope">{sections ? 'Searching titles, topics and full text' : 'Searching titles and topics…'}</span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </dialog>
  )
}
