/**
 * A series landing page (/blog/series/<slug>): a specialized blog collection
 * page. It uses the same header, typography, cards, newsletter and footer as
 * the rest of the blog; it is not a separate section of the site.
 *
 * Series posts keep their canonical /blog/<post-slug> URLs. Planned parts
 * (registry `plannedPosts`) show their title and date but never link to an
 * empty article page.
 */
import { useEffect } from 'react'
import { Link } from './router'
import { formatDate, getSeries, postSeriesSlug, postUrl, related, seriesPosts, seriesTotal, type PlannedPost, type PostMeta, type SeriesInfo } from './data'
import { Newsletter } from './components/layout'
import { Icon } from './components/ui'
import { PostCard } from './BlogIndex'
import { NotFound } from './PostPage'
import { seriesHead, setHead } from './head'
import { useHydrated } from './hydrated'
import { useReader } from './store'

interface PartRow {
  position: number
  post?: PostMeta
  planned?: PlannedPost
}

interface PartGroup {
  heading?: string
  sub?: string
  id?: string
  rows: PartRow[]
}

/** Published parts + planned parts, grouped by stage (or one group when the series has no stages). */
function buildGroups(s: SeriesInfo, list: PostMeta[]): PartGroup[] {
  const published = new Map<number, PostMeta>()
  for (const p of list) if (p.seriesPart) published.set(p.seriesPart, p)
  const row = (position: number): PartRow => ({ position, post: published.get(position), planned: published.has(position) ? undefined : s.plannedPosts.find((x) => x.position === position) })
  const positions = [...new Set([...published.keys(), ...s.plannedPosts.map((x) => x.position)])].sort((a, b) => a - b)
  if (!s.stages.length) return [{ rows: positions.map(row) }]

  const groups: PartGroup[] = s.stages
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((st) => ({
      heading: `Stage ${st.position}: ${st.title}`,
      sub: st.description,
      id: `stage-${st.position}`,
      rows: positions.filter((n) => (published.get(n)?.seriesStage ?? s.plannedPosts.find((x) => x.position === n)?.stage) === st.title).map(row),
    }))
  const grouped = new Set(groups.flatMap((g) => g.rows.map((r) => r.position)))
  const rest = positions.filter((n) => !grouped.has(n)).map(row)
  if (rest.length) groups.push({ heading: 'Articles', rows: rest })
  return groups.filter((g) => g.rows.length)
}

function PartRowView({ row }: { row: PartRow }) {
  const { position, post, planned } = row
  return (
    <li className={`b-series-part ${post ? '' : 'is-planned'}`}>
      <span className="b-series-part__n" aria-hidden="true">
        {String(position).padStart(2, '0')}
      </span>
      <div className="b-series-part__body">
        {post ? (
          <p className="b-series-part__title">
            <Link href={postUrl(post)}>{post.title}</Link>
          </p>
        ) : (
          <p className="b-series-part__title">{planned?.title ?? `Part ${position}`}</p>
        )}
        <p className="b-series-part__meta">
          {post ? (
            <>
              {post.minutes} min read · <time dateTime={post.date}>{formatDate(post.date)}</time>
            </>
          ) : planned?.scheduledDate ? (
            <>
              Publishing <time dateTime={planned.scheduledDate}>{formatDate(planned.scheduledDate)}</time>
            </>
          ) : (
            'Planned'
          )}
        </p>
      </div>
      {post ? (
        <Link href={postUrl(post)} className="b-series-part__go" aria-label={`Read part ${position}: ${post.title}`}>
          Read article <Icon name="arrow" size={15} />
        </Link>
      ) : (
        <span className="b-series-part__soon">Upcoming</span>
      )}
    </li>
  )
}

export default function SeriesPage({ slug }: { slug: string }) {
  const s = getSeries(slug)
  const list = s ? seriesPosts(slug) : []
  const { progress } = useReader()
  const hydrated = useHydrated()

  useEffect(() => {
    if (s) setHead(seriesHead(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (!s || s.status !== 'published') return <NotFound />

  const total = seriesTotal(s, list.length)
  const groups = buildGroups(s, list)
  const first = list[0]
  // "Continue with Part N" when the reader has an unfinished part in this series
  const continuePost = hydrated
    ? list
        .filter((p) => {
          const pr = progress[p.slug]
          return pr && !pr.done && pr.p > 0.02
        })
        .sort((a, b) => (progress[b.slug]?.t ?? 0) - (progress[a.slug]?.t ?? 0))[0]
    : undefined
  const readCount = hydrated ? list.filter((p) => progress[p.slug]?.done).length : 0
  const rel = list.length ? related(list[0], 6).filter((p) => postSeriesSlug(p) !== slug).slice(0, 3) : []

  return (
    <main id="main" className="b-series-page" tabIndex={-1}>
      <header className="b-series-hero">
        <nav aria-label="Breadcrumb" data-preview="hover">
          <ol className="b-crumbs">
            <li>
              <Link href="/blog">Notebook</Link>
            </li>
            <li>
              <Link href="/blog#series">Series</Link>
            </li>
            <li>
              <span aria-current="page">{s.title}</span>
            </li>
          </ol>
        </nav>
        <p className="b-kicker">Blog series</p>
        <h1>{s.title}</h1>
        <p className="b-lede">{s.subtitle ?? s.description}</p>
        <p className="b-series-hero__meta">
          {list.length} of {total} published{s.stages.length ? ` · ${s.stages.length} stages` : ''}{s.cadence ? ` · ${s.cadence}` : ''}
        </p>
        <div className="b-series-progressbar" role="progressbar" aria-label={`${list.length} of ${total} parts published`} aria-valuenow={list.length} aria-valuemin={0} aria-valuemax={total}>
          <span style={{ width: `${total ? (list.length / total) * 100 : 0}%` }} />
        </div>
        {hydrated && readCount > 0 && (
          <p className="b-series-hero__read">
            You have read {readCount} of {list.length} published {readCount === 1 ? 'part' : 'parts'}.
          </p>
        )}
        <div className="b-hero__actions">
          {(continuePost ?? first) && (
            <Link className="b-btn" href={postUrl(continuePost ?? first!)}>
              {continuePost ? `Continue with Part ${continuePost.seriesPart}` : `Start with Part ${first!.seriesPart}`} <Icon name="arrow" size={16} />
            </Link>
          )}
          {continuePost && first && first !== continuePost && (
            <Link className="b-btn is-ghost" href={postUrl(first)}>
              Start with Part {first.seriesPart}
            </Link>
          )}
          <Link className="b-btn is-ghost" href="/blog">
            All posts
          </Link>
        </div>
      </header>

      {s.introduction && (
        <section className="b-series-intro" aria-label="About this series">
          {s.introduction.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      )}

      <section className="b-series-contents" aria-labelledby="contents-title">
        <h2 className="b-section-title" id="contents-title">
          Series contents
        </h2>
        {groups.map((g, i) => (
          <div key={g.heading ?? i} className="b-series-stage">
            {g.heading && (
              <div className="b-series-stage__head">
                <h3 id={g.id}>{g.heading}</h3>
                {g.sub && <p>{g.sub}</p>}
              </div>
            )}
            <ol className="b-series-parts">
              {g.rows.map((r) => (
                <PartRowView key={r.position} row={r} />
              ))}
            </ol>
          </div>
        ))}
        {total > list.length + s.plannedPosts.filter((x) => !list.some((p) => p.seriesPart === x.position)).length && (
          <p className="b-series-more">
            {total - list.length - s.plannedPosts.filter((x) => !list.some((p) => p.seriesPart === x.position)).length} more {total - list.length - s.plannedPosts.filter((x) => !list.some((p) => p.seriesPart === x.position)).length === 1 ? 'part' : 'parts'} planned.
          </p>
        )}
      </section>

      {rel.length > 0 && (
        <section className="b-related" aria-labelledby="related-title">
          <h2 className="b-section-title" id="related-title">
            Related writing
          </h2>
          <div className="b-grid">
            {rel.map((p) => (
              <PostCard key={p.slug} p={p} />
            ))}
          </div>
        </section>
      )}

      <div id="subscribe">
        <Newsletter />
      </div>
    </main>
  )
}
