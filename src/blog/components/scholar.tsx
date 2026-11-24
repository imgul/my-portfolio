/**
 * Scholarly UI: ORCID iD, article information (licence, DOI, downloads),
 * "Cite this post" in seven formats, research profiles and the /blog/research page.
 * All data and formats come from ../scholar.mjs, shared with the build.
 */
import { useEffect, useState } from 'react'
import { Link } from '../router'
import { formatDate, posts, SITE_URL, type PostMeta } from '../data'
import { activeProfiles, AUTHOR, citation, citationMeta, CITE_FORMATS, citeKey, doiUrl, LICENSES, OPEN_CATEGORIES, type CiteFormat } from '../scholar.mjs'
import { copy, Icon, toast } from './ui'

/* ------------------------------------------------------------------ ORCID */

/** The official ORCID iD icon (green circle with "iD"). */
export function OrcidIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="b-orcid__icon" width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <path fill="#A6CE39" d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" />
      <path
        fill="#FFF"
        d="M86.3 186.2H70.9V79.1h15.4v107.1zM108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7C191.7 111.2 178 93 148 93h-23.7v79.4zM88.7 56.8c0 5.5-4.5 10.1-10.1 10.1s-10.1-4.6-10.1-10.1c0-5.6 4.5-10.1 10.1-10.1s10.1 4.6 10.1 10.1z"
      />
    </svg>
  )
}

/**
 * ORCID iD link. ORCID's display guidelines ask for the icon plus the full
 * https URL; `compact` shows only the icon (with an accessible name) for tight
 * spaces such as the byline.
 */
export function OrcidLink({ compact }: { compact?: boolean }) {
  return (
    <a className={`b-orcid ${compact ? 'is-compact' : ''}`} href={AUTHOR.orcidUrl} target="_blank" rel="noopener noreferrer me author" title="ORCID iD: Muhammad Gulzaib">
      <OrcidIcon size={compact ? 16 : 18} />
      {compact ? <span className="sr-only">ORCID iD (opens in a new tab)</span> : <span>{AUTHOR.orcidUrl}</span>}
    </a>
  )
}

/* ------------------------------------------------------------ head sync */

const SCHOLAR_SEL = 'meta[name^="citation_"], meta[name^="DC."], link[rel="license"], link[rel="cite-as"], link[rel="alternate"][type="application/pdf"]'

/** Remove a previous post's bibliographic tags (client-side navigation). */
export function clearScholarMeta() {
  document.head.querySelectorAll(SCHOLAR_SEL).forEach((el) => el.remove())
}

/**
 * Keep citation tags correct after client-side navigation, so Zotero/Mendeley
 * capture the post you're on (pre-rendered pages already have them).
 */
export function syncScholarMeta(p: PostMeta) {
  clearScholarMeta()
  const url = `${SITE_URL}/blog/${p.slug}`
  const add = (tag: 'meta' | 'link', attrs: Record<string, string>) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    document.head.appendChild(el)
  }
  add('link', { rel: 'alternate', type: 'application/pdf', title: 'PDF version', href: `${url}.pdf` })
  const lic = LICENSES[p.license]
  if (lic.open) add('link', { rel: 'license', href: lic.url })
  if (p.doi) add('link', { rel: 'cite-as', href: doiUrl(p.doi) })
  for (const [name, content] of citationMeta(p, SITE_URL)) add('meta', { name, content })
}

/* ------------------------------------------------------- article info */

function download(name: string, text: string, mime: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  toast(`Downloaded ${name}`)
}

export function LicenseBadge({ p }: { p: PostMeta }) {
  const lic = LICENSES[p.license]
  if (!lic.open) return null
  return (
    <a className="b-license-badge" href={lic.url} target="_blank" rel="license noopener noreferrer" title={lic.name}>
      <span aria-hidden="true">cc</span> Open access · {lic.short}
      <span className="sr-only"> (licence, opens in a new tab)</span>
    </a>
  )
}

/** Licence, identifiers and downloads at the end of every post. */
export function ArticleInfo({ p }: { p: PostMeta }) {
  const lic = LICENSES[p.license]
  const url = `${SITE_URL}/blog/${p.slug}`
  const year = p.date.slice(0, 4)
  const file = (f: CiteFormat) => CITE_FORMATS.find((x) => x.id === f)!
  return (
    <section className="b-artinfo" aria-labelledby="artinfo-title">
      <h2 className="b-artinfo__title" id="artinfo-title">
        Article information
      </h2>
      <dl className="b-artinfo__list">
        <div>
          <dt>Author</dt>
          <dd>
            <a href="/" rel="author">
              {AUTHOR.name}
            </a>
            <OrcidLink />
          </dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>
            <time dateTime={p.date}>{formatDate(p.date)}</time>
            {p.updated && (
              <>
                {' '}
                · updated <time dateTime={p.updated}>{formatDate(p.updated)}</time>
              </>
            )}{' '}
            in <cite>Gul’s Notebook</cite>
          </dd>
        </div>
        <div>
          <dt>{p.doi ? 'DOI' : 'Permanent link'}</dt>
          <dd className="b-artinfo__id">
            <a href={p.doi ? doiUrl(p.doi) : url}>{p.doi ? doiUrl(p.doi) : url}</a>
            <button type="button" className="b-iconbtn" onClick={() => copy(p.doi ? doiUrl(p.doi) : url, p.doi ? 'DOI copied' : 'Link copied')} aria-label={p.doi ? 'Copy DOI' : 'Copy permanent link'}>
              <Icon name="copy" size={15} />
            </button>
          </dd>
        </div>
        <div>
          <dt>Licence</dt>
          <dd>
            {lic.open ? (
              <>
                <a href={lic.url} target="_blank" rel="license noopener noreferrer">
                  {lic.name}<span className="sr-only"> (opens in a new tab)</span>
                </a>{' '}
                ({lic.short}). {lic.summary}
              </>
            ) : (
              <>
                © {year} {AUTHOR.name}. {lic.summary}
              </>
            )}{' '}
            Code samples are MIT.
          </dd>
        </div>
        <div>
          <dt>Download</dt>
          <dd className="b-artinfo__dl">
            <a href={`/blog/${p.slug}.pdf`} download={`${citeKey(p)}.pdf`}>
              <Icon name="pdf" size={15} /> PDF
            </a>
            <a href={`/blog/${p.slug}.md`}>
              <Icon name="markdown" size={15} /> Markdown
            </a>
            {(['bibtex', 'ris'] as const).map((f) => (
              <button type="button" key={f} onClick={() => download(`${citeKey(p)}.${file(f).file}`, citation(p, f, SITE_URL), file(f).mime!)}>
                <Icon name="download" size={15} /> {file(f).label}
              </button>
            ))}
          </dd>
        </div>
      </dl>
      <p className="b-artinfo__more">
        <Link href="/blog/research">How to cite and reuse this blog →</Link>
      </p>
    </section>
  )
}

export function CiteThis({ p, open }: { p: PostMeta; open?: boolean }) {
  const [fmt, setFmt] = useState<CiteFormat>('apa')
  const text = citation(p, fmt, SITE_URL)
  const f = CITE_FORMATS.find((x) => x.id === fmt)!
  return (
    <details className="b-citethis" open={open}>
      <summary>
        <Icon name="quote" size={16} /> Cite this post
      </summary>
      <div className="b-citethis__tabs" role="group" aria-label="Citation format">
        {CITE_FORMATS.map((c) => (
          <button type="button" key={c.id} aria-pressed={fmt === c.id} onClick={() => setFmt(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <pre tabIndex={0} aria-label={`${f.label} citation`} aria-live="polite">
        {text}
      </pre>
      <div className="b-citethis__acts">
        <button type="button" className="b-btn is-sm is-ghost" onClick={() => copy(text, `${f.label} citation copied`)}>
          <Icon name="copy" size={14} /> Copy {f.label}
        </button>
        {f.file && (
          <button type="button" className="b-btn is-sm is-ghost" onClick={() => download(`${citeKey(p)}.${f.file}`, text, f.mime!)}>
            <Icon name="download" size={14} /> Download .{f.file}
          </button>
        )}
        <span className="b-citethis__hint">Zotero, Mendeley and EndNote can also import this page directly.</span>
      </div>
    </details>
  )
}

/* ------------------------------------------------------------ profiles */

export function ResearchProfiles({ className = '' }: { className?: string }) {
  const list = activeProfiles(true)
  return (
    <ul className={`b-profiles ${className}`} aria-label="Research profiles">
      {list.map((pr) => (
        <li key={pr.id}>
          <a href={pr.url} target="_blank" rel="noopener noreferrer me">
            {pr.id === 'orcid' ? <OrcidIcon size={16} /> : <Icon name="id" size={16} />}
            {pr.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------- research page */

export function ResearchPage() {
  const open = posts.filter((p) => LICENSES[p.license].open)
  const example = open[0]
  useEffect(() => {
    document.title = 'Research & citation: Muhammad Gulzaib · Gul’s Notebook'
  }, [])
  return (
    <main id="main" className="b-research" tabIndex={-1}>
      <header className="b-research__head">
        <nav aria-label="Breadcrumb" data-preview="hover">
          <ol className="b-crumbs">
            <li>
              <Link href="/blog">Notebook</Link>
            </li>
            <li>
              <span aria-current="page">Research &amp; citation</span>
            </li>
          </ol>
        </nav>
        <h1>Research &amp; citation</h1>
        <p className="b-lede">
          I publish open-access notes on AI systems, software engineering and technical writing. This page lists my identifiers, the posts you can reuse, and how to cite them.
        </p>
      </header>

      <section className="b-research__id" aria-labelledby="r-id">
        <span className="b-author__avatar" aria-hidden="true">
          <img src="/img/gul/avatar.webp" alt="" width="56" height="56" decoding="async" />
        </span>
        <div>
          <h2 id="r-id">{AUTHOR.name}</h2>
          <p className="b-research__role">
            {AUTHOR.jobTitle} · {AUTHOR.location}
          </p>
          <p className="b-research__orcid">
            <OrcidLink />
          </p>
          {activeProfiles(true).length > 1 && <ResearchProfiles />}
        </div>
      </section>

      <section aria-labelledby="r-pubs">
        <h2 id="r-pubs" className="b-section-title">
          Open-access posts <span className="b-count">{open.length}</span>
        </h2>
        <p className="b-research__note">
          {OPEN_CATEGORIES.join(', ').replace(/, ([^,]*)$/, ' and $1')} posts are licensed{' '}
          <a href={LICENSES['CC-BY-4.0'].url} target="_blank" rel="noopener noreferrer">
            CC BY 4.0<span className="sr-only"> (opens in a new tab)</span>
          </a>
          . Each has a PDF, a permanent link and machine-readable citation metadata. DOIs appear here once they are registered.
        </p>
        <ol className="b-pubs">
          {open.map((p) => (
            <li key={p.slug} className="b-pub">
              <p className="b-pub__title">
                <Link href={`/blog/${p.slug}`}>{p.title}</Link>
              </p>
              <p className="b-pub__meta">
                <span>{AUTHOR.name}</span>
                <span>
                  <time dateTime={p.date}>{formatDate(p.date)}</time>
                </span>
                <span>{p.category}</span>
                {p.doi ? (
                  <a href={doiUrl(p.doi)} className="b-pub__doi">
                    doi:{p.doi}
                  </a>
                ) : null}
              </p>
              <p className="b-pub__acts">
                <a href={`/blog/${p.slug}.pdf`} download={`${citeKey(p)}.pdf`}>
                  <Icon name="pdf" size={14} /> PDF
                </a>
                <button type="button" onClick={() => copy(citation(p, 'apa', SITE_URL), 'APA citation copied')}>
                  <Icon name="quote" size={14} /> Copy APA
                </button>
                <button type="button" onClick={() => copy(citation(p, 'bibtex', SITE_URL), 'BibTeX copied')}>
                  <Icon name="copy" size={14} /> Copy BibTeX
                </button>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="r-cite">
        <h2 id="r-cite" className="b-section-title">
          How to cite
        </h2>
        <p>Cite the author, title, date and the post’s DOI (or its URL if it doesn’t have one yet). For example:</p>
        {example && <CiteThis p={example} open />}
        <p>Every post page has the same “Cite this post” box (APA, MLA, Chicago, IEEE, Harvard, BibTeX and RIS), and reference managers can save a post straight from its page.</p>
      </section>

      <section aria-labelledby="r-reuse">
        <h2 id="r-reuse" className="b-section-title">
          Reuse
        </h2>
        <ul className="b-research__list">
          <li>
            <strong>Open-access posts ({OPEN_CATEGORIES.join(', ')}):</strong> {LICENSES['CC-BY-4.0'].summary}
          </li>
          <li>
            <strong>Founder posts:</strong> {LICENSES['all-rights-reserved'].summary}
          </li>
          <li>
            <strong>Code samples:</strong> MIT licence, unless a post says otherwise.
          </li>
          <li>
            <strong>Search engines and AI assistants</strong> are welcome to read, quote and cite any post with a link (see <a href="/llms.txt">llms.txt</a>).
          </li>
        </ul>
      </section>

      <section aria-labelledby="r-machine">
        <h2 id="r-machine" className="b-section-title">
          For indexes and archives
        </h2>
        <ul className="b-research__list">
          <li>
            <a href="/feeds/open-access.xml">Open-access feed</a> (Atom, full text, CC BY posts only, with ORCID and DOIs)
          </li>
          <li>
            <a href="/rss.xml">RSS</a> and <a href="/feed.json">JSON Feed</a> with every post in full
          </li>
          <li>
            <a href="/sitemap.xml">Sitemap</a>, <a href="/llms.txt">llms.txt</a> and <a href="/llms-full.txt">llms-full.txt</a>
          </li>
          <li>Each open post includes Highwire Press (citation_*) and Dublin Core metadata, schema.org ScholarlyArticle data with the author’s ORCID iD, and a PDF.</li>
        </ul>
      </section>
    </main>
  )
}
