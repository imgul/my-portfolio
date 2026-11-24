/**
 * SEO audit of the built site (dist/). Runs at the end of `npm run build`
 * (scripts/prerender.mjs) and fails the build on errors, so a new post or page
 * can't ship without its title, description, canonical URL, share image or
 * structured data. Also: `npm run seo:check` after a build.
 *
 * Errors:   missing <title> / description / canonical / og:title / og:description /
 *           og:url / og:image / twitter:card; an og:image that isn't in dist/;
 *           invalid JSON-LD; canonical or og:url on another host; a sitemap URL
 *           without a page; duplicate titles or descriptions.
 * Warnings: title over 70 characters, description outside 50–170, no JSON-LD,
 *           no <h1> in the HTML, image without width/height.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1]
const decode = (s = '') => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function headOf(html) {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || undefined)
  const metas = {}
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const k = attr(m[0], 'property') || attr(m[0], 'name')
    if (k && !(k in metas)) metas[k] = decode(attr(m[0], 'content') ?? '')
  }
  const links = {}
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(m[0], 'rel')
    if (rel && !(rel in links)) links[rel] = attr(m[0], 'href')
  }
  return {
    title: decode(head.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''),
    metas,
    links,
    ld: [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]),
    robots: metas.robots || '',
  }
}

/** Every HTML page in dist/ with the URL it is served at (vercel.json: cleanUrls). */
function pages(dist) {
  const out = []
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, f.name)
      if (f.isDirectory()) {
        if (!['assets', 'og', 'link-icons', 'feeds', '.vite'].includes(f.name)) walk(file)
      } else if (f.name.endsWith('.html')) {
        const rel = path.relative(dist, file).replace(/\\/g, '/')
        out.push({ file, rel, url: rel === 'index.html' ? '/' : `/${rel.replace(/\.html$/, '')}` })
      }
    }
  }
  walk(dist)
  return out
}

export function checkSeo(dist, { siteUrl }) {
  const errors = []
  const warnings = []
  const host = new URL(siteUrl).host
  const seen = { title: new Map(), description: new Map() }
  const list = pages(dist)
  for (const pg of list) {
    const html = fs.readFileSync(pg.file, 'utf8')
    const h = headOf(html)
    const err = (m) => errors.push(`${pg.url}: ${m}`)
    const warn = (m) => warnings.push(`${pg.url}: ${m}`)
    const noindex = /noindex/.test(h.robots)
    const desc = h.metas.description
    if (!h.title) err('missing <title>')
    else if (h.title.length > 70) warn(`title is ${h.title.length} characters (search results show ~60)`)
    if (!desc) err('missing meta description')
    else if (desc.length < 50 || desc.length > 170) warn(`description is ${desc.length} characters (aim for 70–160)`)
    if (!noindex) {
      if (!h.links.canonical) err('missing canonical link')
      else if (new URL(h.links.canonical, siteUrl).host !== host) err(`canonical points to another host: ${h.links.canonical}`)
      for (const [k, v] of [['title', h.title], ['description', desc]]) {
        if (!v) continue
        if (seen[k].has(v)) err(`same ${k} as ${seen[k].get(v)}`)
        else seen[k].set(v, pg.url)
      }
    }
    for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) if (!h.metas[k] && !(noindex && k === 'og:url')) err(`missing ${k}`)
    if (h.metas['og:url'] && new URL(h.metas['og:url'], siteUrl).host !== host) err(`og:url points to another host: ${h.metas['og:url']}`)
    const img = h.metas['og:image']
    if (img) {
      const u = new URL(img, siteUrl)
      if (u.host !== host) warn(`og:image on another host: ${img}`)
      else if (!fs.existsSync(path.join(dist, decodeURIComponent(u.pathname)))) err(`og:image not found in the build: ${u.pathname}`)
      if (!h.metas['og:image:width'] || !h.metas['og:image:height']) warn('og:image has no width/height')
      if (!h.metas['og:image:alt']) warn('og:image has no alt text')
    }
    if (!h.ld.length && !noindex) warn('no JSON-LD structured data')
    for (const j of h.ld) {
      try {
        JSON.parse(j)
      } catch (e) {
        err(`invalid JSON-LD: ${e.message}`)
      }
    }
    if (!noindex && !/<h1\b/i.test(html)) warn('no <h1> in the HTML')
  }
  // every sitemap URL must be a real page
  const sm = path.join(dist, 'sitemap.xml')
  if (fs.existsSync(sm)) {
    const urls = new Set(list.map((p) => p.url))
    for (const m of fs.readFileSync(sm, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = new URL(m[1])
      const p = u.pathname.replace(/\/$/, '') || '/'
      if (u.host !== host) errors.push(`sitemap: ${m[1]} is on another host`)
      else if (!urls.has(p)) errors.push(`sitemap: ${m[1]} has no page in the build`)
    }
  } else errors.push('sitemap.xml is missing')
  return { pages: list.length, errors, warnings }
}

export function report({ pages: n, errors, warnings }) {
  for (const w of warnings) console.warn(`  seo warning  ${w}`)
  for (const e of errors) console.error(`  seo ERROR    ${e}`)
  console.log(`seo: ${n} pages checked, ${errors.length} errors, ${warnings.length} warnings`)
}

// CLI: node scripts/seo-check.mjs [dist]
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const { SITE_URL } = await import('./blog.mjs')
  const r = checkSeo(path.resolve(process.argv[2] || path.join(root, 'dist')), { siteUrl: SITE_URL })
  report(r)
  process.exit(r.errors.length ? 1 : 0)
}
