/**
 * Post-build step (npm run build runs it after `vite build` + the SSR build).
 *
 * Writes into dist/:
 *   index.html                                           the landing page's <head> (meta, OG, JSON-LD) + a no-JS summary
 *   blog.html, blog/<slug>.html, 404.html               pre-rendered pages (full text, JSON-LD, OG tags)
 *   blog/series/<slug>.html                              series landing pages (CollectionPage + ItemList JSON-LD)
 *   blog/research.html                                   research & citation page (ORCID, profiles, open-access posts)
 *   privacy.html, terms.html, cookies.html               legal pages (src/blog/LegalPage.tsx), served at /privacy etc.
 *   blog/<slug>.md                                       clean Markdown copy of each post (for AI tools / notes)
 *   blog/<slug>.pdf                                      PDF version (Google Scholar citation_pdf_url, Zenodo uploads)
 *   og/home.png, og/blog.png, og/research.png,
 *   og/404.png, og/<slug>.png, og/series-<slug>.png       1200×630 Open Graph images, one per page (scripts/og.mjs)
 *   rss.xml, feed.json                                   feeds with full post content
 *   feeds/open-access.xml, feeds/open-access.json        CC BY posts only (register with Rogue Scholar for DOIs)
 *   <INDEXNOW_KEY>.txt                                   IndexNow key (npm run blog:indexnow pings Bing & co.)
 *   sitemap.xml, robots.txt, llms.txt, llms-full.txt     discovery for search engines and AI assistants
 *
 * Then audits every page (scripts/seo-check.mjs) and fails the build on missing tags or images.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { createHash } from 'node:crypto'
import { AUTHOR, CATEGORIES, BLOG_TITLE, BLOG_DESCRIPTION, INDEXNOW_KEY, SITE_URL, headTags, homeHeadTags, homeHtml, homeNoscript, jsonFeed, llmsTxt, openAccessAtom, pageHtml, postUrl, robots, rss, setOgVersions, sitemap } from './blog.mjs'
import { LICENSES, ORCID, doiUrl } from '../src/blog/scholar.mjs'
import { LEGAL } from '../src/blog/legal.mjs'
import { SERIES } from '../src/blog/series.mjs'
import { createOg } from './og.mjs'
import { coverPng } from './covers.mjs'
import { loadPosts as loadSources, POSTS_DIR } from './blog.mjs'
import { checkSeo, report } from './seo-check.mjs'
import { postPdf } from './pdf.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, '.ssr')
const require = createRequire(import.meta.url)
const t0 = Date.now()

const write = (rel, data) => {
  const file = path.join(dist, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
}

/* ------------------------------------------------------------ load builds */

const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const manifestFile = path.join(dist, '.vite', 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
const ssrEntry = fs.readdirSync(ssrDir).find((f) => /^ssr\.(m?js)$/.test(f))
const ssr = await import(pathToFileURL(path.join(ssrDir, ssrEntry)).href)
const posts = ssr.posts.filter((p) => !p.draft)

/* --------------------------------------------- preload the blog's CSS / JS */

function collect(key, seen = new Set()) {
  const chunk = manifest[key]
  if (!chunk || seen.has(key)) return { js: [], css: [] }
  seen.add(key)
  const out = { js: [chunk.file], css: [...(chunk.css ?? [])] }
  for (const imp of chunk.imports ?? []) {
    const sub = collect(imp, seen)
    out.js.push(...sub.js)
    out.css.push(...sub.css)
  }
  return out
}
const blogKey = Object.keys(manifest).find((k) => k.endsWith('src/blog/main.tsx'))
if (!blogKey) throw new Error('prerender: src/blog/main.tsx not found in the Vite manifest')
const blog = collect(blogKey)
const fontAsset = Object.values(manifest)
  .flatMap((c) => c.assets ?? [])
  .find((a) => /source-serif-4-latin-opsz-normal.*\.woff2$/.test(a))

function preloadTags(slug) {
  const js = new Set(blog.js)
  if (slug) {
    const k = Object.keys(manifest).find((x) => x.endsWith(`src/blog/posts/${slug}.mdx`))
    if (k) collect(k).js.forEach((f) => js.add(f))
  }
  return [
    ...[...new Set(blog.css)].map((f) => `<link rel="stylesheet" href="/${f}" />`),
    fontAsset ? `<link rel="preload" href="/${fontAsset}" as="font" type="font/woff2" crossorigin />` : '',
    ...[...js].map((f) => `<link rel="modulepreload" href="/${f}" />`),
  ]
    .filter(Boolean)
    .join('\n    ')
}

/* -------------------------------------------------------------- og images */

// rendered first: every page's <head> links its image with a content hash (?v=…)
const SECOND = '#6f8fdc'
const og = createOg({
  site: { blogTitle: BLOG_TITLE, host: SITE_URL.replace(/^https?:\/\//, ''), categories: CATEGORIES },
  colorOf: ssr.categoryColor,
  coverOf: (p) => ssr.coverSvg(p, 'transparent', SECOND),
  licenses: LICENSES,
})
const content = { profile: ssr.profile, ventures: ssr.ventures, manifesto: ssr.manifesto, education: ssr.education, stack: ssr.stack, languages: ssr.languages }
const images = {
  home: og.home({ profile: content.profile, ventures: content.ventures, posts }),
  blog: og.blog(posts, { title: BLOG_TITLE, description: 'Notes on building companies, shipping software and thinking with AI.' }),
  research: og.research(posts, { orcid: ORCID }),
  404: og.notFound(),
  legal: og.page({ kicker: 'Privacy · Terms · Cookies', title: 'No ads, no analytics, no tracking cookies', sub: 'How gulzaib.vercel.app handles the little data it sees.', color: '#4f7fd8', right: [SITE_URL.replace(/^https?:\/\//, '')] }),
  ...Object.fromEntries(posts.map((p) => [p.slug, og.post(p)])),
  ...Object.fromEntries(SERIES.filter((s) => s.status === 'published').map((s) => [`series-${s.slug}`, og.series(s, posts.filter((p) => p.seriesSlug === s.slug))])),
}
// a post with a `cover:` block shares its featured image (plus a small brand pill) instead of the notebook card
const sources = new Map(loadSources(POSTS_DIR, { includeDrafts: true }).map((p) => [p.slug, p]))
for (const p of posts) {
  const src = sources.get(p.slug)
  if (src?.cover) images[p.slug] = (await coverPng(src)) ?? images[p.slug]
}
const versions = {}
for (const [key, buf] of Object.entries(images)) {
  write(`og/${key}.png`, buf)
  versions[key] = createHash('sha1').update(buf).digest('hex').slice(0, 8)
}
setOgVersions(versions)

/* ------------------------------------------------------------------ pages */

// the landing page: generated <head> (title, description, canonical, OG, JSON-LD) and a no-JS summary
write('index.html', homeHtml(indexHtml, { head: homeHeadTags(content, posts), noscript: homeNoscript(content, posts) }))

const page = (url, opts, kind) =>
  pageHtml(indexHtml, { head: headTags(opts), preload: preloadTags(opts.post?.slug), body: ssr.renderPage(url) }).replace('data-ssr="1"', `data-ssr="${kind}"`)

// blog.html + blog/<slug>.html are served at /blog and /blog/<slug> (vercel.json cleanUrls)
write('blog.html', page('/blog', { posts }, 'index'))
for (const p of posts) write(`blog/${p.slug}.html`, page(`/blog/${p.slug}`, { post: p, posts }, 'post'))
// series landing pages: /blog/series/<slug> (the static "series" segment wins over /blog/<post-slug>)
for (const s of SERIES.filter((s) => s.status === 'published')) write(`blog/series/${s.slug}.html`, page(`/blog/series/${s.slug}`, { posts, series: s }, 'series'))
write('blog/research.html', page('/blog/research', { posts, research: true }, 'research'))
// privacy.html, terms.html, cookies.html: the legal pages, served at /privacy, /terms, /cookies
for (const l of LEGAL) write(`${l.path.slice(1)}.html`, page(l.path, { legal: l, posts }, 'legal'))
// the 404 page is served for any unknown URL, so its pre-paint script must always apply the blog theme
const BLOG_PREPAINT = '/^\\/(blog|privacy|terms|cookies)(\\/|$)/.test(location.pathname)'
if (!indexHtml.includes(BLOG_PREPAINT)) throw new Error('prerender: the pre-paint check in index.html changed; update BLOG_PREPAINT')
write('404.html', page('404', { notFound: true }, '404').replace(BLOG_PREPAINT, 'true'))

/* --------------------------------------------------------------- markdown */

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '_' })
td.use(gfm)
td.remove(['button', 'script', 'style', 'svg'])
td.addRule('katex', {
  filter: (n) => n.nodeName === 'SPAN' && /\bkatex(-display)?\b/.test(n.getAttribute('class') || '') && !n.parentNode?.closest?.('.katex'),
  replacement: (_c, n) => {
    const tex = n.querySelector('annotation')?.textContent?.trim() ?? ''
    return /katex-display/.test(n.getAttribute('class') || '') ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`
  },
})
td.addRule('fencedLang', {
  filter: (n) => n.nodeName === 'PRE' && !!n.querySelector('code'),
  replacement: (_c, n) => {
    const code = n.querySelector('code')
    const lang = n.getAttribute('data-language') || code.getAttribute('data-language') || ''
    const lines = [...code.querySelectorAll('[data-line]')]
    const text = (lines.length ? lines.map((l) => l.textContent).join('\n') : code.textContent).split('\n').map((l) => l.trimEnd()).join('\n')
    const fig = n.parentNode?.nodeName === 'FIGURE' ? n.parentNode.querySelector('figcaption')?.textContent : ''
    return `\n\n${fig ? `\`${fig}\`\n` : ''}\`\`\`${lang === 'plaintext' ? '' : lang}\n${text.replace(/\n$/, '')}\n\`\`\`\n\n`
  },
})
td.addRule('codeTitle', { filter: (n) => n.nodeName === 'FIGCAPTION' && n.hasAttribute('data-rehype-pretty-code-title'), replacement: () => '' })
td.addRule('kicker', {
  filter: (n) => n.nodeName === 'P' && /\bb-kicker\b/.test(n.getAttribute('class') || ''),
  replacement: (c) => `\n\n**${c.trim()}**\n\n`,
})
td.addRule('aside', {
  filter: (n) => n.nodeName === 'ASIDE',
  replacement: (c) => `\n\n${c.trim().split('\n').map((l) => `> ${l}`.trimEnd()).join('\n')}\n\n`,
})
// decorative glyphs (callout icons etc.) are aria-hidden: not content
td.addRule('decorative', { filter: (n) => n.getAttribute?.('aria-hidden') === 'true' && !/katex/.test(n.getAttribute('class') || ''), replacement: () => '' })
td.addRule('flowStep', {
  filter: (n) => n.nodeName === 'SPAN' && /\bb-flow__(n|label|note)\b/.test(n.getAttribute('class') || ''),
  replacement: (c, n) => {
    const cls = n.getAttribute('class')
    return /b-flow__n\b/.test(cls) ? '' : /b-flow__label/.test(cls) ? `**${c.trim()}**` : `: ${c.trim()}`
  },
})
// component parts that are visually separate but adjacent in the HTML
const cls = (n) => (n.getAttribute && n.getAttribute('class')) || ''
td.addRule('boldTitles', {
  filter: (n) => /\bb-(decision__title|proscons__title|step__title|linkcard__title|postlink__title)\b/.test(cls(n)),
  replacement: (c, n) => (n.nodeName === 'P' ? `\n\n**${c.trim()}**\n\n` : `**${c.trim()}**`),
})
td.addRule('cardKicker', { filter: (n) => /\bb-kicker\b/.test(cls(n)) && !!n.closest?.('a'), replacement: () => '' })
td.addRule('cardDesc', { filter: (n) => /\bb-(linkcard|postlink)__desc\b/.test(cls(n)), replacement: (c) => `: ${c.trim()}` })
td.addRule('decisionStatus', { filter: (n) => /\bb-decision__status\b/.test(cls(n)), replacement: (c) => ` · ${c.trim()}` })
td.addRule('sidenote', { filter: (n) => /\bb-sidenote__body\b/.test(cls(n)), replacement: (c) => ` (${c.trim()})` })
td.addRule('calloutTitle', {
  filter: (n) => n.nodeName === 'P' && /\bb-callout__title\b/.test(n.getAttribute('class') || ''),
  replacement: (c) => `\n\n**${c.trim()}**\n\n`,
})
td.addRule('details', { filter: ['details'], replacement: (c) => `\n\n${c.trim()}\n\n` })
td.addRule('summary', { filter: ['summary'], replacement: (c) => `\n\n**${c.trim()}**\n\n` })

const absolutize = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${SITE_URL}/`)

const articles = {}
const markdown = {}
const bodies = {}
for (const p of posts) {
  const html = absolutize(ssr.renderArticle(p.slug))
  articles[p.slug] = html
    .replace(/<span class="b-callout__icon" aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<span class="b-flow__n">(\d+)<\/span>/g, '')
    .replace(/<span class="b-flow__note">/g, '<span>: ')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<\/span><span/g, '</span> <span')
    .replace(/<button[\s\S]*?<\/button>/g, '')
    .replace(/\s(class|style|tabindex|data-[\w-]+)="[^"]*"/g, '')
    .replace(/<span>\s*<\/span>/g, '')
  const body = td.turndown(html).replace(/\n{3,}/g, '\n\n').trim()
  bodies[p.slug] = body
  const lic = LICENSES[p.license]
  const fm = [
    '---',
    `title: ${JSON.stringify(p.title)}`,
    `description: ${JSON.stringify(p.description)}`,
    `author: ${AUTHOR.name}`,
    `orcid: ${AUTHOR.orcidUrl}`,
    `published: ${p.date}`,
    p.updated ? `updated: ${p.updated}` : '',
    `url: ${postUrl(p)}`,
    p.doi ? `doi: ${doiUrl(p.doi)}` : '',
    `category: ${p.category}`,
    `tags: [${p.tags.join(', ')}]`,
    p.series ? `series: ${JSON.stringify(p.series)}${p.seriesPart ? ` (part ${p.seriesPart})` : ''}` : '',
    `reading_time: ${p.minutes} min`,
    lic.open ? `license: ${lic.short} (${lic.url}); code samples MIT` : `license: © ${p.date.slice(0, 4)} ${AUTHOR.name}, all rights reserved (quote with a link); code samples MIT`,
    '---',
  ]
    .filter(Boolean)
    .join('\n')
  markdown[p.slug] = `${fm}\n\n# ${p.title}\n\n> ${p.description}\n\nBy ${AUTHOR.name} · ${p.date}${p.updated ? ` (updated ${p.updated})` : ''} · ${p.minutes} min read · ${postUrl(p)}\n\n${body}\n`
  write(`blog/${p.slug}.md`, markdown[p.slug])
}

/* ------------------------------------------------------------- feeds etc. */

write('rss.xml', rss(posts, articles))
write('feed.json', jsonFeed(posts, articles))
write('feeds/open-access.xml', openAccessAtom(posts, articles))
write(
  'feeds/open-access.json',
  jsonFeed(
    posts.filter((p) => LICENSES[p.license].open),
    articles,
    { feedPath: '/feeds/open-access.json', title: `${BLOG_TITLE}: open-access posts (CC BY 4.0)` },
  ),
)
write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY)

/* ------------------------------------------------------------------- pdfs */

await Promise.all(posts.map(async (p) => write(`blog/${p.slug}.pdf`, await postPdf(p, bodies[p.slug], { site: SITE_URL }))))
write('sitemap.xml', sitemap(posts))
write('robots.txt', robots())
write('llms.txt', llmsTxt(posts))
write(
  'llms-full.txt',
  `# ${BLOG_TITLE}: full text\n\n> ${BLOG_DESCRIPTION}\n\nEvery post by ${AUTHOR.name}, newest first. Source: ${SITE_URL}/blog\n\n` +
    posts.map((p) => markdown[p.slug].replace(/^---[\s\S]*?---\n\n/, '')).join('\n\n---\n\n'),
)

/* ---------------------------------------------------------------- tidy up */

fs.rmSync(ssrDir, { recursive: true, force: true })
fs.rmSync(path.dirname(manifestFile), { recursive: true, force: true })
console.log(`prerender: ${posts.length} posts → pages, Markdown, PDFs, ${Object.keys(images).length} OG images, feeds, sitemap, llms.txt (${Date.now() - t0} ms)`)

/* -------------------------------------------------------------- SEO audit */

const audit = checkSeo(dist, { siteUrl: SITE_URL })
report(audit)
if (audit.errors.length) process.exit(1)
