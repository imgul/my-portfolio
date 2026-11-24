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
 * and a stale good result beats a fresh failure. On top of that, a committed
 * snapshot (data/link-previews.snapshot.json: metadata + the real favicons)
 * is refreshed by GitHub Actions (.github/workflows/link-previews.yml), so
 * cards stay complete even when a site blocks the build machine or the build
 * runs offline. The build never fails because a site is down: missing links
 * fall back to /api/link-preview at runtime, and then to a card built from
 * the URL alone.
 *
 *   node scripts/link-previews.mjs            # after a build
 *   node scripts/link-previews.mjs --snapshot # refetch everything into the snapshot
 *   LINK_PREVIEWS=off npm run build           # skip fetching (uses cache + snapshot)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPosts, POSTS_DIR, SITE_URL, BLOG_TITLE, BLOG_DESCRIPTION, RESEARCH_DESCRIPTION } from './blog.mjs'
import { parseHtml, fetchPreview, toEntry, previewKey, dataUri, SKIP_URL, SITE_HOSTS } from './link-meta.mjs'
import { LICENSES, ORCID } from '../src/blog/scholar.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE_FILE = path.join(ROOT, 'node_modules/.cache/gul-link-previews/cache.json')
const SNAPSHOT_FILE = path.join(ROOT, 'data/link-previews.snapshot.json')
const FRESH_MS = 3 * 24 * 3600e3
const STALE_MS = 45 * 24 * 3600e3
const CATEGORY_COLOR = { Founder: '#d4834f', Engineering: '#5a84d6', 'AI Research': '#9a6fd1', Writing: '#3a9c7c' }

/** Hand-written cards for pages that block bots (LinkedIn answers 999 to everyone). */
const OVERRIDES = {
  'x.com/gulzaib_ai': {
    k: 'profile',
    t: 'Muhammad Gulzaib (@gulzaib_ai)',
    s: 'X',
    d: 'Founder & CEO of SynergyFlow Labs · Senior Full Stack Engineer building AI-native SaaS with Laravel, React and agentic AI.',
    m: ['@gulzaib_ai', 'Islamabad'],
    av: '/img/gul/gulzaib.jpg',
    c: '#0f1419',
  },
  'linkedin.com/in/gulzaib-ai': {
    k: 'profile',
    t: 'Muhammad Gulzaib',
    s: 'LinkedIn',
    d: 'Founder & CEO of SynergyFlow Labs · Senior Full Stack Engineer building AI-native SaaS with Laravel, React and agentic AI. Islamabad, Pakistan.',
    m: ['Founder & CEO', 'Islamabad'],
    av: '/img/gul/gulzaib.jpg',
    c: '#0a66c2',
  },
  'wa.me/923026999008': {
    k: 'profile',
    t: 'Chat with Muhammad Gulzaib',
    s: 'WhatsApp',
    d: 'Message Gul directly on WhatsApp for projects, collaborations or a quick hello.',
    m: ['WhatsApp', 'Usually replies within a day'],
    av: '/img/gul/gulzaib.jpg',
    c: '#25d366',
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

/** Cards for when a site can't be fetched at all (down, or blocking bots). Real metadata wins when it loads. */
const FALLBACKS = {
  'anysub.app': {
    k: 'web',
    t: 'AnySub: any subscription, one system',
    s: 'AnySub',
    d: 'A calm, serious operating system for subscriptions. Track every SaaS tool, free trial and renewal, with budgets, audit trails and team comments.',
    m: ['SaaS', 'Building in public'],
    c: '#ff6b3d',
  },
  'oxygenlms.com': {
    k: 'web',
    t: 'Oxygen LMS: an operating system for education',
    s: 'Oxygen LMS',
    d: 'Schools, colleges and academies on one platform: academics, attendance, fees, HR, parents and AI assistants. Simple and mobile-first.',
    m: ['EdTech', 'Multi-tenant SaaS'],
    c: '#5b8cff',
  },
  'gulzaib.dev': {
    k: 'profile',
    t: 'Muhammad Gulzaib',
    s: 'gulzaib.dev',
    d: 'Founder & CEO of SynergyFlow Labs. Senior Full Stack Engineer building AI-native SaaS with Laravel, React and agentic AI.',
    m: ['Founder', 'Full Stack', 'AI systems'],
    av: '/img/gul/gulzaib.jpg',
    c: '#c6ff3d',
  },
  'vu.edu.pk': {
    k: 'web',
    t: 'Virtual University of Pakistan',
    s: 'vu.edu.pk',
    d: 'Public university founded in 2002 to bring quality education to the doorstep of every citizen, online and across the country.',
    m: ['Public university', 'Est. 2002'],
    c: '#1d3f8f',
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
    img: '/og/home.png',
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

/** The committed snapshot: { v, links: { [url]: { at, entry, icon } } } (same shape as the cache). */
export function readSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')).links || {}
  } catch {
    return {}
  }
}

const packIcon = (icon) => (icon ? { type: icon.type, ext: icon.ext, hash: icon.hash, b64: icon.body.toString('base64') } : undefined)

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
  const snapshot = readSnapshot()
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
    const snap = snapshot[url]?.entry?.ok ? snapshot[url] : null
    // the local cache, unless the committed snapshot is newer
    const local = cache[url]
    const cached = local?.entry?.ok ? (snap && snap.at > local.at ? snap : local) : snap || local
    const age = cached ? Date.now() - cached.at : Infinity
    let entry
    let icon
    if (cached?.entry?.ok && age < FRESH_MS) {
      entry = cached.entry
      icon = cached.icon
      reused++
    } else if (fetchExternal) {
      const r = await fetchPreview(url)
      const fallback = cached?.entry?.ok && age < STALE_MS ? cached : snap
      if (r.ok || !fallback) {
        entry = toEntry(r)
        icon = packIcon(r.icon) || cached?.icon || snap?.icon
      } else {
        entry = fallback.entry
        icon = fallback.icon || packIcon(r.icon)
        reused++
      }
    } else if (cached) {
      entry = cached.entry
      icon = cached.icon
      if (entry?.ok) reused++
    } else entry = { ok: 0 }
    nextCache[url] = { at: entry === cached?.entry ? cached.at : Date.now(), entry, icon }
    icon ||= snapshot[url]?.icon // failed links still keep their favicon
    const ov = OVERRIDES[key] || (!entry?.ok && FALLBACKS[key])
    const iconRef = icon ? saveIcon({ ...icon, body: Buffer.from(icon.b64, 'base64') }) : undefined
    entries[key] = ov ? { ...entry, ...ov, ok: 1, ...(iconRef ? { i: iconRef } : {}) } : { ...entry, ...(iconRef ? { i: iconRef } : {}) }
    if (entries[key].ok) ok++
  })
  for (const [key, ov] of Object.entries({ ...FALLBACKS, ...OVERRIDES })) if (!entries[key]) entries[key] = { ok: 1, ...ov }
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

/**
 * Refetch every external link into the committed snapshot. A link that fails
 * now keeps its last good snapshot (sites go down; the card shouldn't).
 * Entries only get a new date when their content changes, so diffs stay small.
 */
export async function writeSnapshot({ dist = null, log = () => {} } = {}) {
  const urls = collectExternal({ dist })
  const old = readSnapshot()
  const links = {}
  const failed = []
  await pool(urls, 6, async (url) => {
    const r = await fetchPreview(url)
    const prev = old[url]
    if (!r.ok) {
      failed.push([url, String(r.error || 'no metadata')])
      if (prev?.entry?.ok) links[url] = r.icon && !prev.icon ? { ...prev, icon: packIcon(r.icon) } : prev
      else if (r.icon || prev?.icon) links[url] = { at: prev?.icon && (!r.icon || prev.icon.hash === r.icon.hash) ? prev.at : Date.now(), entry: { ok: 0 }, icon: packIcon(r.icon) || prev.icon }
      return
    }
    const next = { entry: toEntry(r), icon: packIcon(r.icon) || prev?.icon }
    const same = prev && JSON.stringify(prev.entry) === JSON.stringify(next.entry) && prev.icon?.hash === next.icon?.hash
    links[url] = { at: same ? prev.at : Date.now(), ...next }
    log(`  ✓ ${url}${next.icon ? '' : '  (no icon)'}`)
  })
  // one link per line: readable diffs in pull requests
  const body = Object.keys(links)
    .sort()
    .map((u) => `    ${JSON.stringify(u)}: ${JSON.stringify(links[u])}`)
    .join(',\n')
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true })
  failed.sort((a, b) => a[0].localeCompare(b[0]))
  const fails = failed.map(([u, e]) => `    ${JSON.stringify(u)}: ${JSON.stringify(e)}`).join(',\n')
  fs.writeFileSync(SNAPSHOT_FILE, `{\n  "v": 1,\n  "links": {\n${body}\n  },\n  "failing": {\n${fails}\n  }\n}\n`)
  for (const [u, e] of failed) log(`  ✗ ${u} (${e})`)
  log(`link previews snapshot: ${Object.values(links).filter((l) => l.entry.ok).length}/${urls.length} links, ${failed.length} failed now → ${path.relative(ROOT, SNAPSHOT_FILE)}`)
  return { links, failed }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dist = path.join(ROOT, 'dist')
  if (process.argv.includes('--snapshot')) {
    await writeSnapshot({ dist: fs.existsSync(path.join(dist, 'blog')) ? dist : null, log: console.log })
  } else {
    const manifest = await buildManifest({ dist, fetchExternal: process.env.LINK_PREVIEWS !== 'off', log: console.log })
    fs.writeFileSync(path.join(dist, 'link-previews.json'), JSON.stringify(manifest))
  }
}
