/**
 * Blog content pipeline, shared by the Vite plugin (virtual:blog index in dev
 * and build) and scripts/prerender.mjs (static HTML, feeds, sitemap, llms.txt,
 * Markdown copies and Open Graph images).
 *
 * A post is one MDX file in src/blog/posts/<slug>.mdx with YAML frontmatter:
 *
 *   title:        required, aim for 30–65 characters (search results truncate ~60)
 *   description:  required, 70–160 characters; used for cards, meta description, feeds
 *   date:         required, YYYY-MM-DD
 *   updated:      optional, YYYY-MM-DD (shown as "Updated", used as dateModified)
 *   category:     Founder | Engineering | AI Research | Writing
 *   tags:         [list, of, tags] (1–8)
 *   series:       optional series name
 *   seriesPart:   optional number (1, 2, 3…)
 *   featured:     optional, true pins it as the featured post
 *   draft:        optional, true hides it in production builds
 *   art:          cover art: galaxy | dna | road | city | book | stack | network | tree | mountains | globe
 *   level:        optional: Beginner | Intermediate | Advanced
 *   references:   optional list of { id, title, authors, year, venue, url } for <Cite id="…" />
 *   faq:          optional list of { q, a }: rendered at the end + FAQPage structured data
 *
 * Run `npm run lint:blog` to check posts against the guidelines in docs/BLOG_GUIDELINES.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'

export const SITE_URL = (process.env.VITE_SITE_URL || 'https://gulzaib.vercel.app').replace(/\/$/, '')
export const AUTHOR = {
  name: 'Muhammad Gulzaib',
  email: 'iigulzaib@gmail.com',
  url: SITE_URL,
  jobTitle: 'Founder & CEO, SynergyFlow Labs · Senior Full Stack Engineer',
  sameAs: ['https://www.linkedin.com/in/gulzaib-ai', 'https://github.com/imgul'],
  knowsAbout: ['SaaS', 'Laravel', 'React', 'Retrieval-augmented generation', 'AI agents', 'Product validation', 'Technical writing'],
}
export const BLOG_TITLE = 'Gul’s Notebook'
export const BLOG_DESCRIPTION =
  'Notes from building AI-native SaaS: founder lessons, engineering deep dives, AI systems research and the craft of technical writing, by Muhammad Gulzaib.'
export const CATEGORIES = ['Founder', 'Engineering', 'AI Research', 'Writing']
export const ARTS = ['galaxy', 'dna', 'road', 'city', 'book', 'stack', 'network', 'tree', 'mountains', 'globe']

/** Absolute path of the posts folder (forward slashes). */
export const POSTS_DIR = fileURLToPath(new URL('../src/blog/posts', import.meta.url)).replace(/\\/g, '/')

const WPM = 230
const toISO = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : undefined)
const stripCode = (src) => src.replace(/^```[\s\S]*?^```/gm, '')

/** Strip MDX/markdown syntax to count words that a reader actually reads. */
function plainText(src) {
  return src
    .replace(/```[\s\S]*?```/g, (m) => ' ' + m.split('\n').slice(1, -1).join(' ').replace(/[^\w\s]/g, ' ') + ' ')
    // keep visible text that lives in props (step titles, captions, pros/cons, chart labels)
    .replace(/<[^>]+>/g, (m) => ' ' + (m.match(/"[^"]*"/g) || []).filter((q) => /\s/.test(q)).join(' ').replace(/"/g, ' ') + ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/[#>*_`~[\](){}|-]/g, ' ')
}

/** h2/h3 headings with the same ids rehype-slug generates (for the TOC, rendered without JS). */
function extractHeadings(content) {
  const slugger = new GithubSlugger()
  const out = []
  for (const line of stripCode(content).split('\n')) {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const text = m[2]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
      .replace(/<[^>]+>/g, '')
      .trim()
    const id = slugger.slug(text)
    if (m[1].length === 2 || m[1].length === 3) out.push({ depth: m[1].length, text, id })
  }
  return out
}

export function loadPosts(dir = POSTS_DIR, { includeDrafts = false } = {}) {
  if (!fs.existsSync(dir)) return []
  const posts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const { data, content } = matter(raw)
      const slug = file.replace(/\.mdx$/, '')
      const words = plainText(content).split(/\s+/).filter(Boolean).length
      const codeBlocks = (content.match(/```/g) || []).length / 2
      return {
        slug,
        title: String(data.title ?? slug),
        description: String(data.description ?? ''),
        date: toISO(data.date) ?? '1970-01-01',
        updated: toISO(data.updated),
        category: data.category ?? 'Engineering',
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        series: data.series ? String(data.series) : undefined,
        seriesPart: data.seriesPart ? Number(data.seriesPart) : undefined,
        featured: !!data.featured,
        draft: !!data.draft,
        art: data.art ?? 'galaxy',
        level: data.level,
        references: Array.isArray(data.references)
          ? data.references.map((r) => ({
              id: String(r.id),
              title: String(r.title ?? ''),
              authors: r.authors ? String(r.authors) : undefined,
              year: r.year ? String(r.year) : undefined,
              venue: r.venue ? String(r.venue) : undefined,
              url: r.url ? String(r.url) : undefined,
            }))
          : [],
        faq: Array.isArray(data.faq) ? data.faq.filter((f) => f && f.q && f.a).map((f) => ({ q: String(f.q), a: String(f.a) })) : [],
        headings: extractHeadings(content),
        words,
        // code takes longer to read than prose
        minutes: Math.max(1, Math.round(words / WPM + codeBlocks * 0.4)),
      }
    })
    .filter((p) => includeDrafts || !p.draft)
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)))
}

/* ------------------------------------------------------------------- lint */

/**
 * Checks every post against docs/BLOG_GUIDELINES.md. Returns { errors, warnings }.
 * Errors break things (bad frontmatter, broken links); warnings are advice.
 */
export function lintPosts(dir = POSTS_DIR) {
  const errors = []
  const warnings = []
  const posts = loadPosts(dir, { includeDrafts: true })
  const slugs = new Set(posts.map((p) => p.slug))
  const descs = new Map()
  for (const p of posts) {
    const err = (m) => errors.push(`${p.slug}: ${m}`)
    const warn = (m) => warnings.push(`${p.slug}: ${m}`)
    const { content } = matter(fs.readFileSync(path.join(dir, `${p.slug}.mdx`), 'utf8'))
    const body = stripCode(content)

    if (!/^[a-z0-9][a-z0-9-]*$/.test(p.slug)) err('file name must be lowercase-with-hyphens (it becomes the URL)')
    if (!p.title || p.title === p.slug) err('missing title')
    else if (p.title.length > 70) warn(`title is ${p.title.length} chars; search results show ~60`)
    else if (p.title.length < 20) warn(`title is only ${p.title.length} chars; be more specific`)
    if (!p.description) err('missing description')
    else if (p.description.length < 70 || p.description.length > 170) warn(`description is ${p.description.length} chars; aim for 70–160`)
    if (descs.has(p.description)) warn(`same description as ${descs.get(p.description)}`)
    descs.set(p.description, p.slug)
    if (p.date === '1970-01-01' || Number.isNaN(Date.parse(p.date))) err('missing or invalid date (YYYY-MM-DD)')
    if (p.updated && p.updated < p.date) err('updated is before date')
    if (!CATEGORIES.includes(p.category)) err(`category must be one of ${CATEGORIES.join(', ')}`)
    if (!ARTS.includes(p.art)) err(`art must be one of ${ARTS.join(', ')}`)
    if (!p.tags.length) warn('add 1–8 tags')
    if (p.tags.length > 8) warn('more than 8 tags dilutes topics')
    if (p.tags.some((t) => t !== t.toLowerCase())) warn('use lowercase tags')
    if (!/<(TLDR|Abstract)>/.test(content)) warn('start with a <TLDR> (or <Abstract>): an answer-first summary helps readers, search snippets and AI answers')
    if (/^# /m.test(body)) err('do not use "# " (h1) in the body; the title is the only h1')

    let last = 1
    for (const line of body.split('\n')) {
      const m = /^(#{2,6})\s/.exec(line)
      if (!m) continue
      const d = m[1].length
      if (d > last + 1) warn(`heading level jumps from h${last} to h${d}: "${line.trim()}"`)
      last = d
    }
    if (p.headings.filter((h) => h.depth === 2).length < 2 && p.words > 600) warn('long post with fewer than 2 sections (## headings)')

    for (const m of body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) if (!m[1].trim()) err(`image without alt text: ${m[2]}`)
    for (const m of body.matchAll(/<(img|Figure)\b[^>]*\bsrc=/g)) {
      const tag = body.slice(m.index, body.indexOf('>', m.index) + 1)
      if (!/\balt="[^"]+"/.test(tag)) err(`<${m[1]}> without alt text`)
    }
    for (const m of body.matchAll(/\]\((\/blog\/[^)#?\s]+)/g)) if (!slugs.has(m[1].slice(6))) err(`broken internal link ${m[1]}`)
    for (const m of body.matchAll(/<PostLink\s+slug="([^"]+)"/g)) if (!slugs.has(m[1])) err(`<PostLink> to missing post "${m[1]}"`)
    for (const m of body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) if (m[1].startsWith('http://')) warn(`insecure link ${m[1]}`)
    for (const m of body.matchAll(/\[(here|click here|this|link)\]\(/gi)) warn(`vague link text "${m[1]}": describe where the link goes`)

    const refIds = new Set(p.references.map((r) => r.id))
    const cited = new Set([...body.matchAll(/<Cite\s+id="([^"]+)"/g)].map((m) => m[1]))
    for (const id of cited) if (!refIds.has(id)) err(`<Cite id="${id}"> has no matching reference`)
    for (const id of refIds) if (!cited.has(id)) warn(`reference "${id}" is never cited`)

    if (p.series && p.seriesPart && posts.some((q) => q !== p && q.series === p.series && q.seriesPart === p.seriesPart)) err(`duplicate seriesPart ${p.seriesPart} in "${p.series}"`)
    if (p.words < 300 && !p.draft) warn(`only ${p.words} words; thin pages rank and get cited less`)
  }
  return { errors, warnings, count: posts.length }
}

/* ------------------------------------------------------------------ feeds */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
export const postUrl = (p) => `${SITE_URL}/blog/${p.slug}`
export const ogImage = (p) => `${SITE_URL}/og/${p ? p.slug : 'blog'}.png`

export function rss(posts, html = {}) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${postUrl(p)}</link>
      <guid isPermaLink="true">${postUrl(p)}</guid>
      <pubDate>${new Date(p.date + 'T09:00:00Z').toUTCString()}</pubDate>
      <dc:creator>${esc(AUTHOR.name)}</dc:creator>
      <description>${esc(p.description)}</description>
      <category>${esc(p.category)}</category>${p.tags.map((t) => `\n      <category>${esc(t)}</category>`).join('')}${
        html[p.slug] ? `\n      <content:encoded>${cdata(html[p.slug])}</content:encoded>` : ''
      }
      <enclosure url="${ogImage(p)}" type="image/png" length="0" />
    </item>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${esc(BLOG_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
    <description>${esc(BLOG_DESCRIPTION)}</description>
    <language>en</language>
    <copyright>© ${new Date().getFullYear()} ${esc(AUTHOR.name)}</copyright>
    <managingEditor>${AUTHOR.email} (${esc(AUTHOR.name)})</managingEditor>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image><url>${ogImage()}</url><title>${esc(BLOG_TITLE)}</title><link>${SITE_URL}/blog</link></image>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}

export function jsonFeed(posts, html = {}) {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: BLOG_TITLE,
      home_page_url: `${SITE_URL}/blog`,
      feed_url: `${SITE_URL}/feed.json`,
      description: BLOG_DESCRIPTION,
      language: 'en',
      authors: [{ name: AUTHOR.name, url: SITE_URL }],
      items: posts.map((p) => ({
        id: postUrl(p),
        url: postUrl(p),
        title: p.title,
        summary: p.description,
        content_html: html[p.slug],
        image: ogImage(p),
        date_published: `${p.date}T09:00:00Z`,
        date_modified: `${p.updated ?? p.date}T09:00:00Z`,
        tags: [p.category, ...p.tags],
      })),
    },
    null,
    2,
  )
}

export function sitemap(posts) {
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: posts[0]?.date },
    { loc: `${SITE_URL}/blog`, lastmod: posts.map((p) => p.updated ?? p.date).sort().at(-1), image: ogImage() },
    ...posts.map((p) => ({ loc: postUrl(p), lastmod: p.updated ?? p.date, image: ogImage(p) })),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.image ? `<image:image><image:loc>${u.image}</image:loc></image:image>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`
}

/** Search engines and AI assistants are explicitly welcome to read and cite the blog. */
export function robots() {
  const ai = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'Bingbot',
    'DuckAssistBot',
    'Amazonbot',
    'meta-externalagent',
    'CCBot',
  ]
  return `# Search engines and AI assistants are welcome to read, quote and cite this site.
# A plain-text guide for language models lives at ${SITE_URL}/llms.txt

User-agent: *
Allow: /

${ai.map((a) => `User-agent: ${a}`).join('\n')}
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
}

/** https://llmstxt.org: a Markdown map of the site for language models. */
export function llmsTxt(posts) {
  const byCat = CATEGORIES.map((c) => [c, posts.filter((p) => p.category === c)]).filter(([, ps]) => ps.length)
  return `# ${BLOG_TITLE}: Muhammad Gulzaib

> ${BLOG_DESCRIPTION}

Written by Muhammad Gulzaib (Gul), Founder & CEO of SynergyFlow Labs and a senior full stack engineer in Islamabad, Pakistan. Posts are first-hand notes from building SaaS products (Laravel, React), AI systems (RAG, agents) and early-stage companies. Every post has a clean Markdown version (the links below) and the full corpus is at ${SITE_URL}/llms-full.txt. Please cite posts by title and URL.

${byCat
  .map(
    ([c, ps]) => `## ${c}

${ps.map((p) => `- [${p.title}](${postUrl(p)}.md): ${p.description}`).join('\n')}`,
  )
  .join('\n\n')}

## Optional

- [Portfolio](${SITE_URL}/): Muhammad Gulzaib's experience, ventures and skills
- [RSS feed](${SITE_URL}/rss.xml): every post with full content
- [JSON feed](${SITE_URL}/feed.json)
`
}

/* ------------------------------------------------------------------- head */

const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#person`,
  name: AUTHOR.name,
  alternateName: 'Gul',
  url: SITE_URL,
  email: `mailto:${AUTHOR.email}`,
  jobTitle: AUTHOR.jobTitle,
  worksFor: { '@type': 'Organization', name: 'SynergyFlow Labs' },
  homeLocation: { '@type': 'Place', name: 'Islamabad, Pakistan' },
  knowsAbout: AUTHOR.knowsAbout,
  sameAs: AUTHOR.sameAs,
}
const BLOG = {
  '@type': 'Blog',
  '@id': `${SITE_URL}/blog#blog`,
  name: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  url: `${SITE_URL}/blog`,
  inLanguage: 'en',
  author: { '@id': PERSON['@id'] },
  publisher: { '@id': PERSON['@id'] },
}

function postGraph(p) {
  const url = postUrl(p)
  const crumbs = [
    { name: 'Home', item: `${SITE_URL}/` },
    { name: BLOG_TITLE, item: `${SITE_URL}/blog` },
    { name: p.category, item: `${SITE_URL}/blog?category=${encodeURIComponent(p.category)}` },
    { name: p.title, item: url },
  ]
  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: p.title,
      description: p.description,
      image: { '@type': 'ImageObject', url: ogImage(p), width: 1200, height: 630 },
      datePublished: `${p.date}T09:00:00+05:00`,
      dateModified: `${p.updated ?? p.date}T09:00:00+05:00`,
      author: { '@id': PERSON['@id'] },
      publisher: { '@id': PERSON['@id'] },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      isPartOf: { '@id': BLOG['@id'] },
      articleSection: p.category,
      keywords: p.tags,
      wordCount: p.words,
      timeRequired: `PT${p.minutes}M`,
      inLanguage: 'en',
      isAccessibleForFree: true,
      ...(p.level ? { educationalLevel: p.level } : {}),
      ...(p.series ? { isPartOf: [{ '@id': BLOG['@id'] }, { '@type': 'CreativeWorkSeries', name: p.series }], position: p.seriesPart } : {}),
      ...(p.references.length
        ? { citation: p.references.map((r) => ({ '@type': 'CreativeWork', name: r.title, ...(r.authors ? { author: r.authors } : {}), ...(r.url ? { url: r.url } : {}), ...(r.year ? { datePublished: r.year } : {}) })) }
        : {}),
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.b-post__dek', '.b-tldr', '.b-abstract', '.b-takeaways'] },
      accessMode: ['textual', 'visual'],
      accessModeSufficient: ['textual'],
      accessibilityFeature: ['alternativeText', 'tableOfContents', 'readingOrder', 'structuralNavigation', 'displayTransformability', 'highContrastDisplay', 'largePrint'],
      accessibilityHazard: 'none',
    },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) },
    PERSON,
    BLOG,
  ]
  if (p.faq.length)
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
  return { '@context': 'https://schema.org', '@graph': graph }
}

function indexGraph(posts) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { ...BLOG, blogPost: posts.map((p) => ({ '@id': `${postUrl(p)}#article` })) },
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/blog#page`,
        url: `${SITE_URL}/blog`,
        name: BLOG_TITLE,
        description: BLOG_DESCRIPTION,
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: AUTHOR.name },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: postUrl(p), name: p.title })),
        },
      },
      PERSON,
    ],
  }
}

/** <head> tags for a blog page: SEO, Open Graph, Twitter, feeds, Markdown alternate and JSON-LD. */
export function headTags({ post, posts, notFound }) {
  const title = notFound ? `Page not found · ${BLOG_TITLE}` : post ? `${post.title} · ${BLOG_TITLE}` : `${BLOG_TITLE}: founder, engineering and AI notes by Muhammad Gulzaib`
  const description = notFound ? 'This page does not exist.' : post ? post.description : BLOG_DESCRIPTION
  const url = post ? postUrl(post) : `${SITE_URL}/blog`
  const img = ogImage(post)
  const imgAlt = post ? `${post.title}, by Muhammad Gulzaib` : `${BLOG_TITLE} by Muhammad Gulzaib`
  const t = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="author" content="${esc(AUTHOR.name)}" />`,
    notFound ? `<meta name="robots" content="noindex" />` : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    notFound ? '' : `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(BLOG_TITLE)}" href="${SITE_URL}/rss.xml" />`,
    `<link rel="alternate" type="application/feed+json" title="${esc(BLOG_TITLE)}" href="${SITE_URL}/feed.json" />`,
    post ? `<link rel="alternate" type="text/markdown" title="Markdown version" href="${url}.md" />` : `<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE_URL}/llms.txt" />`,
    `<meta property="og:site_name" content="${esc(BLOG_TITLE)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:type" content="${post ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${esc(post ? post.title : BLOG_TITLE)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(imgAlt)}" />`,
    ...(post
      ? [
          `<meta property="article:published_time" content="${post.date}T09:00:00+05:00" />`,
          `<meta property="article:modified_time" content="${post.updated ?? post.date}T09:00:00+05:00" />`,
          `<meta property="article:author" content="${AUTHOR.sameAs[0]}" />`,
          `<meta property="article:section" content="${esc(post.category)}" />`,
          ...post.tags.map((tag) => `<meta property="article:tag" content="${esc(tag)}" />`),
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(post ? post.title : BLOG_TITLE)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc(imgAlt)}" />`,
    notFound ? '' : `<script type="application/ld+json">${json(post ? postGraph(post) : indexGraph(posts))}</script>`,
  ]
  return t.filter(Boolean).join('\n    ')
}

/**
 * Turn the built index.html into a blog page: page-specific head, the blog's
 * CSS/JS preloaded (no flash of unstyled content) and pre-rendered HTML in #root.
 */
export function pageHtml(indexHtml, { head, preload = '', body = '' }) {
  return indexHtml
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace(/\s*<link rel="alternate"[^>]*>/g, '')
    .replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '')
    .replace('</head>', `    ${head}\n    ${preload}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-ssr="1">${body}</div>`)
}
