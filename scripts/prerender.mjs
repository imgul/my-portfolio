/**
 * Post-build step (npm run build runs it after `vite build` + the SSR build).
 *
 * Writes into dist/:
 *   blog.html, blog/<slug>.html, 404.html               pre-rendered pages (full text, JSON-LD, OG tags)
 *   blog/research.html                                   research & citation page (ORCID, profiles, open-access posts)
 *   blog/<slug>.md                                       clean Markdown copy of each post (for AI tools / notes)
 *   blog/<slug>.pdf                                      PDF version (Google Scholar citation_pdf_url, Zenodo uploads)
 *   og/blog.png, og/<slug>.png                           1200×630 Open Graph images
 *   rss.xml, feed.json                                   feeds with full post content
 *   feeds/open-access.xml, feeds/open-access.json        CC BY posts only (register with Rogue Scholar for DOIs)
 *   <INDEXNOW_KEY>.txt                                   IndexNow key (npm run blog:indexnow pings Bing & co.)
 *   sitemap.xml, robots.txt, llms.txt, llms-full.txt     discovery for search engines and AI assistants
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { Resvg } from '@resvg/resvg-js'
import { AUTHOR, BLOG_TITLE, BLOG_DESCRIPTION, INDEXNOW_KEY, SITE_URL, headTags, jsonFeed, llmsTxt, openAccessAtom, pageHtml, postUrl, robots, rss, sitemap } from './blog.mjs'
import { LICENSES, doiUrl } from '../src/blog/scholar.mjs'
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

/* ------------------------------------------------------------------ pages */

const page = (url, opts, kind) =>
  pageHtml(indexHtml, { head: headTags(opts), preload: preloadTags(opts.post?.slug), body: ssr.renderPage(url) }).replace('data-ssr="1"', `data-ssr="${kind}"`)

// blog.html + blog/<slug>.html are served at /blog and /blog/<slug> (vercel.json cleanUrls)
write('blog.html', page('/blog', { posts }, 'index'))
for (const p of posts) write(`blog/${p.slug}.html`, page(`/blog/${p.slug}`, { post: p, posts }, 'post'))
write('blog/research.html', page('/blog/research', { posts, research: true }, 'research'))
// the 404 page is served for any unknown URL, so its pre-paint script must always apply the blog theme
write('404.html', page('404', { notFound: true }, '404').replace("location.pathname.indexOf('/blog') === 0", 'true'))

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

/* -------------------------------------------------------------- og images */

const font = (pkg, weight) => {
  const dir = path.dirname(require.resolve(`${pkg}/package.json`))
  const sub = fs.readdirSync(dir).find((d) => d.startsWith(weight))
  return path.join(dir, sub, fs.readdirSync(path.join(dir, sub)).find((f) => f.endsWith('.ttf')))
}
const fontFiles = [
  font('@expo-google-fonts/source-serif-4', '600'),
  font('@expo-google-fonts/source-serif-4', '700'),
  font('@expo-google-fonts/inter', '500'),
  font('@expo-google-fonts/inter', '600'),
]

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Rough glyph widths (em) for wrapping without a layout engine. */
function width(s, size) {
  let w = 0
  for (const ch of s) w += /[A-Z]/.test(ch) ? 0.66 : /[mwMW]/.test(ch) ? 0.8 : /[iljtf.,:;'’!| ]/.test(ch) ? 0.3 : /[0-9]/.test(ch) ? 0.55 : 0.52
  return w * size
}
function wrap(text, size, max, maxLines) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (width(next, size) > max && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines)
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s+\S+$/, '') + '…'
    return cut
  }
  return lines
}

const BG = '#17181c'
// author photo (warm cut-out, from scripts/portrait.mjs)
const AVATAR = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public/img/gul/avatar-og.png')).toString('base64')}`
function ogSvg({ kicker, color, title, sub, art }) {
  let size = 68
  let lines = wrap(title, size, 760, 3)
  while (lines.length >= 3 && size > 52 && width(title, size) > 760 * 2.6) lines = wrap(title, (size -= 4), 760, 3)
  const lh = size * 1.12
  const top = 200 + (3 - lines.length) * lh * 0.35
  const subLines = sub ? wrap(sub, 26, 720, 2) : []
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0.35" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.85" stop-color="${BG}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <g transform="translate(330 0)" opacity="0.95">${art.replace('<svg ', '<svg width="1200" height="630" ')}</g>
  <rect width="1200" height="630" fill="url(#fade)"/>
  <rect x="80" y="96" width="10" height="10" rx="5" fill="${color}"/>
  <text x="102" y="106" font-family="Inter" font-weight="600" font-size="22" letter-spacing="2.5" fill="${color}">${xml(kicker.toUpperCase())}</text>
  ${lines.map((l, i) => `<text x="80" y="${top + i * lh}" font-family="Source Serif 4" font-weight="700" font-size="${size}" fill="#f2eee6">${xml(l)}</text>`).join('\n  ')}
  ${subLines.map((l, i) => `<text x="80" y="${top + lines.length * lh + 16 + i * 36}" font-family="Inter" font-weight="500" font-size="26" fill="#b9b4aa">${xml(l)}</text>`).join('\n  ')}
  <line x1="80" y1="520" x2="1120" y2="520" stroke="#ffffff" stroke-opacity="0.12"/>
  <clipPath id="av"><circle cx="104" cy="566" r="25"/></clipPath>
  <circle cx="104" cy="566" r="25" fill="${color}" fill-opacity="0.22"/>
  <image href="${AVATAR}" x="79" y="541" width="50" height="50" clip-path="url(#av)"/>
  <circle cx="104" cy="566" r="26" fill="none" stroke="${color}" stroke-opacity="0.75" stroke-width="2"/>
  <text x="142" y="560" font-family="Inter" font-weight="600" font-size="22" fill="#f2eee6">${xml(AUTHOR.name)}</text>
  <text x="142" y="588" font-family="Inter" font-weight="500" font-size="19" fill="#9d988f">${xml(BLOG_TITLE)} · ${xml(SITE_URL.replace(/^https?:\/\//, ''))}/blog</text>
</svg>`
}
function png(svg) {
  return new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

const SECOND = '#6f8fdc'
for (const p of posts) {
  const color = ssr.categoryColor(p)
  const kicker = `${p.category}${p.series ? ` · ${p.series}` : ''} · ${p.minutes} min read`
  write(`og/${p.slug}.png`, png(ogSvg({ kicker, color, title: p.title, sub: '', art: ssr.coverSvg(p, 'transparent', SECOND) })))
}
const lead = posts.find((p) => p.featured) ?? posts[0]
write(
  'og/blog.png',
  png(
    ogSvg({
      kicker: `${posts.length} posts · founders · engineers · AI · writing`,
      color: '#d4834f',
      title: BLOG_TITLE,
      sub: 'Notes on building companies, shipping software and thinking with AI.',
      art: lead ? ssr.coverSvg({ ...lead, art: 'galaxy' }, 'transparent', SECOND) : '<svg></svg>',
    }),
  ),
)

/* ---------------------------------------------------------------- tidy up */

fs.rmSync(ssrDir, { recursive: true, force: true })
fs.rmSync(path.dirname(manifestFile), { recursive: true, force: true })
console.log(`prerender: ${posts.length} posts → pages, Markdown, PDFs, OG images, feeds, sitemap, llms.txt (${Date.now() - t0} ms)`)
