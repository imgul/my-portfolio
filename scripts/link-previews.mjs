/**
 * Link previews manifest: dist/link-previews.json (+ dist/link-icons/*).
 *
 * Runs after the pre-render (npm run build). It finds every link on the site
 * (the pre-rendered blog pages, the portfolio content and the post sources),
 * fetches each external page once (title, description, image, theme colour,
 * favicon, plus GitHub stats and DOI metadata), and adds local data for this
 * site's own pages, posts and files. The browser loads the manifest on the
 * first hover, so cards appear instantly.
 *
 * Results are cached in node_modules/.cache between builds (Vercel keeps it),
 * and a stale good result beats a fresh failure. The build never fails
 * because a site is down: missing links fall back to /api/link-preview at
 * runtime, and then to a card built from the URL alone.
 *
 *   node scripts/link-previews.mjs            # after a build
 *   LINK_PREVIEWS=off npm run build           # skip fetching (offline builds)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPosts, POSTS_DIR, SITE_URL, BLOG_TITLE, BLOG_DESCRIPTION, RESEARCH_DESCRIPTION } from './blog.mjs'
import { parseHtml, fetchPreview, toEntry, previewKey, dataUri, SKIP_URL, SITE_HOSTS } from './link-meta.mjs'
import { LICENSES, ORCID } from '../src/blog/scholar.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE_FILE = path.join(ROOT, 'node_modules/.cache/gul-link-previews/cache.json')
const FRESH_MS = 3 * 24 * 3600e3
const STALE_MS = 45 * 24 * 3600e3
const CATEGORY_COLOR = { Founder: '#d4834f', Engineering: '#5a84d6', 'AI Research': '#9a6fd1', Writing: '#3a9c7c' }

/** Hand-written cards for pages that block bots (LinkedIn answers 999 to everyone). */
const OVERRIDES = {
  'linkedin.com/in/gulzaib-ai': {
    k: 'profile',
    t: 'Muhammad Gulzaib',
    s: 'LinkedIn',
    d: 'Founder & CEO of SynergyFlow Labs · Senior Full Stack Engineer building AI-native SaaS with Laravel, React and agentic AI. Islamabad, Pakistan.',
    m: ['Founder & CEO', 'Islamabad'],
    av: '/img/gul/gulzaib.jpg',
    c: '#0a66c2',
  },
  [`orcid.org/${ORCID}`]: {
    k: 'profile',
    t: 'Muhammad Gulzaib',
    s: 'ORCID',
    d: 'ORCID iD for Muhammad Gulzaib: a persistent identifier that links his publications, DOIs and affiliations.',
    m: [`iD ${ORCID}`],
    av: '/img/gul/gulzaib.jpg',
    c: '#a6ce39',
  },
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const kb = (file) => {
  try {
    const n = fs.statSync(file).size
    return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- collect */

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(p)
  }
  return out
}

const URL_RE = /https?:\/\/[^\s"'`<>)\]}\\]+/g
const tidy = (u) => u.replace(/[.,;:!?*]+$/, '').replace(/&amp;/g, '&')

/** Every external URL that appears on the site. */
export function collectExternal({ dist } = {}) {
  const found = new Set()
  const add = (u) => {
    u = tidy(u)
    if (u.includes('${') || u.includes('{') || SKIP_URL.test(u)) return
    let host
    try {
      host = new URL(u).hostname.replace(/^www\./, '')
    } catch {
      return
    }
    if (SITE_HOSTS.includes(host) || !host.includes('.')) return
    found.add(u)
  }
  // portfolio + blog sources (client-rendered pages aren't in dist), post sources
  for (const f of walk(path.join(ROOT, 'src'), ['.ts', '.tsx', '.mjs', '.mdx'])) {
    if (f.endsWith('.d.ts') || f.endsWith('.d.mts')) continue
    for (const m of fs.readFileSync(f, 'utf8').matchAll(URL_RE)) add(m[0])
  }
  for (const p of loadPosts(POSTS_DIR)) for (const r of p.references ?? []) r.doi && add(`https://doi.org/${r.doi}`)
  // the rendered blog pages (catches links built in components, like DOIs)
  if (dist) {
    for (const f of walk(dist, ['.html'])) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/href="(https?:\/\/[^"]+)"/g)) add(m[1])
    }
  }
  return [...found].sort()
}

/* ------------------------------------------------------- internal pages */

function readHead(file) {
  try {
    return parseHtml(fs.readFileSync(file, 'utf8'), SITE_URL)
  } catch {
    return null
  }
}

/** This site's own pages, posts and files (no network). */
export function internalEntries({ dist } = {}) {
  const posts = loadPosts(POSTS_DIR)
  const open = posts.filter((p) => LICENSES[p.license]?.open)
  const e = {}
  const icon = '/favicon.svg'
  const home = readHead(dist ? path.join(dist, 'index.html') : path.join(ROOT, 'index.html'))
  e['/'] = {
    ok: 1,
    k: 'page',
    t: 'Muhammad Gulzaib',
    s: 'Portfolio',
    d: home?.description || 'Founder & CEO of SynergyFlow Labs. Senior Full Stack Engineer building AI-native SaaS.',
    m: ['Founder', 'Full Stack', 'AI systems'],
    img: '/img/gul/og-home.jpg',
    i: icon,
    c: '#c6ff3d',
  }
  e['/blog'] = { ok: 1, k: 'page', t: BLOG_TITLE, s: 'Blog', d: BLOG_DESCRIPTION, img: '/og/blog.png', m: [`${posts.length} posts`, 'Founder · Engineering · AI · Writing'], i: icon }
  e['/blog/research'] = { ok: 1, k: 'page', t: 'Research & citation', s: BLOG_TITLE, d: RESEARCH_DESCRIPTION, m: [`ORCID ${ORCID}`, `${open.length} open-access posts`], i: icon, av: '/img/gul/gulzaib.jpg', c: '#a6ce39' }
  for (const p of posts) {
    const meta = { cat: p.category, c: CATEGORY_COLOR[p.category] }
    e[`/blog/${p.slug}`] = {
      ok: 1,
      k: 'post',
      t: p.title,
      d: p.description,
      s: BLOG_TITLE,
      img: `/og/${p.slug}.png`,
      m: [p.category, `${p.minutes} min read`, fmtDate(p.date)],
      i: icon,
      ...meta,
    }
    e[`/blog/${p.slug}.pdf`] = {
      ok: 1,
      k: 'file',
      f: 'pdf',
      t: p.title,
      s: 'PDF · paper version',
      d: 'Paper-style PDF with title page, abstract, references and a ready-made citation. Good for saving, printing or citing.',
      m: ['PDF', dist && kb(path.join(dist, 'blog', `${p.slug}.pdf`)), 'A4'].filter(Boolean),
      ...meta,
    }
    e[`/blog/${p.slug}.md`] = {
      ok: 1,
      k: 'file',
      f: 'md',
      t: p.title,
      s: 'Markdown copy',
      d: 'The full post as plain Markdown, for note apps, editors and AI tools.',
      m: ['Markdown', dist && kb(path.join(dist, 'blog', `${p.slug}.md`))].filter(Boolean),
      ...meta,
    }
  }
  const files = [
    ['/rss.xml', 'feed', 'RSS feed', `Every post in full, for any feed reader (Feedly, Inoreader, NetNewsWire…).`, ['RSS 2.0', `${posts.length} posts`]],
    ['/feed.json', 'feed', 'JSON Feed', 'The same full-text feed in JSON Feed format.', ['JSON Feed 1.1', `${posts.length} posts`]],
    ['/feeds/open-access.xml', 'feed', 'Open-access feed', 'Only the CC BY 4.0 posts, with ORCID and licence data. Used by Rogue Scholar to register DOIs.', ['Atom', `${open.length} posts`, 'CC BY 4.0']],
    ['/feeds/open-access.json', 'feed', 'Open-access feed (JSON)', 'The CC BY 4.0 posts as a JSON Feed with licence and ORCID metadata.', ['JSON Feed', `${open.length} posts`]],
    ['/llms.txt', 'file', 'llms.txt', 'A short map of the blog for AI assistants and language models.', ['Plain text', 'llmstxt.org']],
    ['/llms-full.txt', 'file', 'llms-full.txt', 'The full text of every post in one file, for language models.', ['Plain text', dist && kb(path.join(dist, 'llms-full.txt'))].filter(Boolean)],
    ['/sitemap.xml', 'file', 'Sitemap', 'Every page on the site, for search engines.', ['XML']],
  ]
  for (const [p, k, t, d, m] of files) e[p] = { ok: 1, k, f: p.split('.').pop(), t, s: BLOG_TITLE, d, m }
  return {
    entries: e,
    posts: posts.map((p) => ({ slug: p.slug, t: p.title, cat: p.category, c: CATEGORY_COLOR[p.category], tags: p.tags, min: p.minutes, date: p.date })),
  }
}

/* --------------------------------------------------------------- build */

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    }),
  )
  return out
}

/**
 * Build the manifest. `dist`: output folder (icons are written to dist/link-icons);
 * without it icons are inlined as data: URIs (dev server).
 */
export async function buildManifest({ dist = null, fetchExternal = true, log = () => {} } = {}) {
  const t0 = Date.now()
  const { entries, posts } = internalEntries({ dist })
  const urls = collectExternal({ dist })
  const cache = readCache()
  const nextCache = {}
  const iconDir = dist && path.join(dist, 'link-icons')
  if (iconDir) fs.mkdirSync(iconDir, { recursive: true })
  const saveIcon = (icon) => {
    if (!icon) return undefined
    if (!iconDir) return dataUri(icon)
    const name = `${icon.hash}.${icon.ext}`
    fs.writeFileSync(path.join(iconDir, name), icon.body)
    return `/link-icons/${name}`
  }
  let ok = 0
  let reused = 0
  await pool(urls, 8, async (url) => {
    const key = previewKey(url)
    if (!key || entries[key]) return
    const cached = cache[url]
    const age = cached ? Date.now() - cached.at : Infinity
    let entry
    let icon
    if (cached?.entry?.ok && age < FRESH_MS) {
      entry = cached.entry
      icon = cached.icon
      reused++
    } else if (fetchExternal) {
      const r = await fetchPreview(url)
      if (r.ok || !(cached?.entry?.ok && age < STALE_MS)) {
        entry = toEntry(r)
        icon = r.icon ? { type: r.icon.type, ext: r.icon.ext, hash: r.icon.hash, b64: r.icon.body.toString('base64') } : cached?.icon
      } else {
        entry = cached.entry
        icon = cached.icon
        reused++
      }
    } else if (cached) {
      entry = cached.entry
      icon = cached.icon
    } else entry = { ok: 0 }
    nextCache[url] = { at: entry === cached?.entry ? cached.at : Date.now(), entry, icon }
    const ov = OVERRIDES[key]
    const iconRef = icon ? saveIcon({ ...icon, body: Buffer.from(icon.b64, 'base64') }) : undefined
    entries[key] = ov ? { ...entry, ...ov, ok: 1, ...(iconRef ? { i: iconRef } : {}) } : { ...entry, ...(iconRef ? { i: iconRef } : {}) }
    if (entries[key].ok) ok++
  })
  for (const [key, ov] of Object.entries(OVERRIDES)) if (!entries[key]) entries[key] = { ok: 1, ...ov }
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ...cache, ...nextCache }))
  } catch {
    /* read-only node_modules: fine */
  }
  log(`link previews: ${urls.length} external links (${ok} previewed, ${reused} from cache), ${Object.keys(entries).length} entries (${Date.now() - t0} ms)`)
  return { v: 1, at: new Date().toISOString(), site: SITE_URL, posts, e: entries }
}

/* ----------------------------------------------------------------- CLI */

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dist = path.join(ROOT, 'dist')
  const manifest = await buildManifest({ dist, fetchExternal: process.env.LINK_PREVIEWS !== 'off', log: console.log })
  fs.writeFileSync(path.join(dist, 'link-previews.json'), JSON.stringify(manifest))
}
