/**
 * Blog content loader, shared by the Vite plugin (virtual:blog index, dev + build)
 * and the build-time generators (RSS, JSON feed, sitemap, per-post HTML with meta tags).
 *
 * A post is one MDX file in src/blog/posts/<slug>.mdx with YAML frontmatter:
 *
 *   title:        required
 *   description:  required, one or two sentences (cards, meta description, RSS)
 *   date:         required, YYYY-MM-DD
 *   updated:      optional, YYYY-MM-DD
 *   category:     Founder | Engineering | AI Research | Writing
 *   tags:         [list, of, tags]
 *   series:       optional series name
 *   seriesPart:   optional number (1, 2, 3…)
 *   featured:     optional, true pins it as the featured post
 *   draft:        optional, true hides it in production builds
 *   art:          cover art shape: galaxy | dna | road | city | book | stack | network | tree | mountains | globe
 *   level:        optional: Beginner | Intermediate | Advanced
 *   references:   optional list of { id, title, authors, year, venue, url } for <Cite id="…" />
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

export const SITE_URL = (process.env.VITE_SITE_URL || 'https://gulzaib.vercel.app').replace(/\/$/, '')
export const AUTHOR = { name: 'Muhammad Gulzaib', email: 'iigulzaib@gmail.com' }
export const BLOG_TITLE = 'Gul’s Notebook'
export const BLOG_DESCRIPTION =
  'Notes from building AI-native SaaS: founder lessons, engineering deep dives, AI systems research and the craft of technical writing.'

const WPM = 230

const toISO = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : undefined)

/** Strip MDX/markdown syntax to count words that a reader actually reads. */
function plainText(src) {
  return src
    .replace(/```[\s\S]*?```/g, (m) => ' ' + m.split('\n').slice(1, -1).join(' ').replace(/[^\w\s]/g, ' ') + ' ')
    // keep visible text that lives in props (step titles, captions, pros/cons, chart labels)
    .replace(/<[^>]+>/g, (m) => ' ' + (m.match(/"[^"]*"/g) || []).filter((q) => /\s/.test(q)).join(' ').replace(/"/g, ' ') + ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/[#>*_`~[\](){}|-]/g, ' ')
}

export function loadPosts(dir, { includeDrafts = false } = {}) {
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
          ? data.references.map((r) => ({ id: String(r.id), title: String(r.title ?? ''), authors: r.authors ? String(r.authors) : undefined, year: r.year ? String(r.year) : undefined, venue: r.venue ? String(r.venue) : undefined, url: r.url ? String(r.url) : undefined }))
          : [],
        words,
        // code takes longer to read than prose
        minutes: Math.max(1, Math.round(words / WPM + codeBlocks * 0.4)),
      }
    })
    .filter((p) => includeDrafts || !p.draft)
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)))
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function rss(posts) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.date + 'T09:00:00Z').toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
      <category>${esc(p.category)}</category>${p.tags.map((t) => `\n      <category>${esc(t)}</category>`).join('')}
    </item>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(BLOG_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
    <description>${esc(BLOG_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}

export function jsonFeed(posts) {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: BLOG_TITLE,
      home_page_url: `${SITE_URL}/blog`,
      feed_url: `${SITE_URL}/feed.json`,
      description: BLOG_DESCRIPTION,
      authors: [{ name: AUTHOR.name, url: SITE_URL }],
      items: posts.map((p) => ({
        id: `${SITE_URL}/blog/${p.slug}`,
        url: `${SITE_URL}/blog/${p.slug}`,
        title: p.title,
        summary: p.description,
        date_published: p.date,
        date_modified: p.updated ?? p.date,
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
    { loc: `${SITE_URL}/blog`, lastmod: posts[0]?.date },
    ...posts.map((p) => ({ loc: `${SITE_URL}/blog/${p.slug}`, lastmod: p.updated ?? p.date })),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
}

/** Clone the built index.html with page-specific <title>, description, Open Graph and JSON-LD. */
export function pageHtml(indexHtml, { title, description, url, type = 'website', post }) {
  const ld = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        author: { '@type': 'Person', name: AUTHOR.name, url: SITE_URL },
        mainEntityOfPage: url,
        keywords: post.tags.join(', '),
      }
    : null
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(BLOG_TITLE)}" href="/rss.xml" />`,
    ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : '',
  ].join('\n    ')
  return indexHtml
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace('</head>', `    ${head}\n  </head>`)
}

/** Absolute path of the posts folder (forward slashes). */
export const POSTS_DIR = fileURLToPath(new URL('../src/blog/posts', import.meta.url)).replace(/\\/g, '/')

/** After a build: feeds, sitemap, robots and a pre-rendered HTML shell per page. */
export function writeBlogFiles(outDir) {
  const posts = loadPosts(POSTS_DIR)
  const index = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')
  const write = (rel, data) => {
    const file = path.join(outDir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, data)
  }
  write('rss.xml', rss(posts))
  write('feed.json', jsonFeed(posts))
  write('sitemap.xml', sitemap(posts))
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`)
  write('blog/index.html', pageHtml(index, { title: `${BLOG_TITLE} · Muhammad Gulzaib`, description: BLOG_DESCRIPTION, url: `${SITE_URL}/blog` }))
  for (const p of posts) {
    write(`blog/${p.slug}/index.html`, pageHtml(index, { title: `${p.title} · ${BLOG_TITLE}`, description: p.description, url: `${SITE_URL}/blog/${p.slug}`, type: 'article', post: p }))
  }
  return posts.length
}
