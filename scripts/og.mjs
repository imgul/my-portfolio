/**
 * Open Graph / Twitter share images (1200×630 PNG), rendered at build time with
 * resvg. scripts/prerender.mjs calls these for every page, so a new post (or a
 * change to the portfolio copy in src/data/content.ts) gets a fresh, matching
 * image on the next build with no manual step.
 *
 *   home(…)      /og/home.png      portfolio: name, role, ventures, latest note, photo on the lime disc
 *   blog(…)      /og/blog.png      blog index: post count, categories, the newest post
 *   post(…)      /og/<slug>.png    each post: category colour, its generative cover, title, summary, date, licence/DOI
 *   research(…)  /og/research.png  research & citation page: ORCID, open-access count, recent research titles
 *   notFound()   /og/404.png
 *   page(…)      generic template for any future page (kicker, title, summary, art)
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)

/* ------------------------------------------------------------------ fonts */

const font = (pkg, weight) => {
  const dir = path.dirname(require.resolve(`${pkg}/package.json`))
  const sub = fs.readdirSync(dir).find((d) => d.startsWith(weight) && !d.includes('Italic'))
  return path.join(dir, sub, fs.readdirSync(path.join(dir, sub)).find((f) => f.endsWith('.ttf')))
}
const fontFiles = [
  font('@expo-google-fonts/source-serif-4', '600'),
  font('@expo-google-fonts/source-serif-4', '700'),
  font('@expo-google-fonts/inter', '500'),
  font('@expo-google-fonts/inter', '600'),
  font('@expo-google-fonts/inter', '800'),
  font('@expo-google-fonts/inter', '900'),
]

/** Render an SVG string to a 1200×630 PNG buffer. */
export function png(svg) {
  return new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

/* ----------------------------------------------------------------- layout */

export const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Rough glyph widths (em) for wrapping without a layout engine. */
export function width(s, size, { bold = false } = {}) {
  let w = 0
  for (const ch of String(s)) w += /[A-Z]/.test(ch) ? 0.66 : /[mwMW]/.test(ch) ? 0.8 : /[iljtf.,:;'’!| ]/.test(ch) ? 0.3 : /[0-9]/.test(ch) ? 0.56 : /[·•—–]/.test(ch) ? 0.5 : 0.53
  return w * size * (bold ? 1.06 : 1)
}

/** Greedy word wrap; the last allowed line gets an ellipsis when the text doesn't fit. */
export function wrap(text, size, max, maxLines) {
  const lines = []
  let line = ''
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (width(next, size) > max && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines)
    cut[maxLines - 1] = cut[maxLines - 1].replace(/[\s,;:.–—-]+\S*$/, '') + '…'
    return cut
  }
  return lines
}

/** Shorten one line to fit `max` px. */
export function fit(text, size, max) {
  let t = String(text)
  if (width(t, size) <= max) return t
  while (t.length > 4 && width(`${t}…`, size) > max) t = t.replace(/\s*\S+$/, '') || t.slice(0, -1)
  return `${t.replace(/[\s,;:.–—-]+$/, '')}…`
}

const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`

/* ------------------------------------------------- notebook (blog) family */

const BG = '#17181c'
const INK = '#f2eee6'
const MUTED = '#b9b4aa'
const FAINT = '#9d988f'
const AVATAR = dataUri('public/img/gul/avatar-og.png', 'image/png')

/**
 * The notebook card: kicker, serif title, optional summary, cover art on the right,
 * author footer (left) and up to two lines of facts (right).
 */
function notebook({ kicker, color, title, sub = '', art = '', foot, right = [], extra = '', top: fixedTop }) {
  let size = 68
  let lines = wrap(title, size, 760, 3)
  while (lines.length >= 3 && size > 50 && width(title, size) > 760 * 2.55) lines = wrap(title, (size -= 4), 760, 3)
  const lh = size * 1.12
  // a summary only fits under one- and two-line titles
  const subLines = sub && lines.length < 3 ? wrap(sub, 26, 740, 2) : []
  const block = lines.length * lh + (subLines.length ? 26 + subLines.length * 36 : 0)
  // centre the title block between the kicker and the footer rule
  const top = fixedTop ?? Math.max(190, 150 + (360 - block) / 2 + size * 0.8)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0.35" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.85" stop-color="${BG}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="av"><circle cx="104" cy="566" r="25"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  ${art ? `<g transform="translate(330 0)" opacity="0.95">${art.replace('<svg ', '<svg width="1200" height="630" ')}</g>` : ''}
  <rect width="1200" height="630" fill="url(#fade)"/>
  <rect x="0" y="0" width="1200" height="6" fill="${color}"/>
  <rect x="80" y="96" width="10" height="10" rx="5" fill="${color}"/>
  <text x="102" y="106" font-family="Inter" font-weight="600" font-size="22" letter-spacing="2.5" fill="${color}">${xml(fit(kicker.toUpperCase(), 22 * 1.12, 980))}</text>
  ${lines.map((l, i) => `<text x="80" y="${(top + i * lh).toFixed(1)}" font-family="Source Serif 4" font-weight="700" font-size="${size}" fill="${INK}">${xml(l)}</text>`).join('\n  ')}
  ${subLines.map((l, i) => `<text x="80" y="${(top + (lines.length - 1) * lh + 26 + 36 + i * 36).toFixed(1)}" font-family="Inter" font-weight="500" font-size="26" fill="${MUTED}">${xml(l)}</text>`).join('\n  ')}
  ${extra}
  <line x1="80" y1="520" x2="1120" y2="520" stroke="#ffffff" stroke-opacity="0.12"/>
  <circle cx="104" cy="566" r="25" fill="${color}" fill-opacity="0.22"/>
  <image href="${AVATAR}" x="79" y="541" width="50" height="50" clip-path="url(#av)"/>
  <circle cx="104" cy="566" r="26" fill="none" stroke="${color}" stroke-opacity="0.75" stroke-width="2"/>
  <text x="142" y="560" font-family="Inter" font-weight="600" font-size="22" fill="${INK}">Muhammad Gulzaib</text>
  <text x="142" y="588" font-family="Inter" font-weight="500" font-size="19" fill="${FAINT}">${xml(foot)}</text>
  ${right
    .filter(Boolean)
    .slice(0, 2)
    .map((t, i) => `<text x="1120" y="${560 + i * 28}" text-anchor="end" font-family="Inter" font-weight="${i ? 500 : 600}" font-size="${i ? 19 : 21}" fill="${i ? FAINT : INK}">${xml(fit(t, i ? 19 : 21, 470))}</text>`)
    .join('\n  ')}
</svg>`
}

/**
 * @param {object} o
 * @param {{ blogTitle: string, host: string, categories?: string[] }} o.site
 * @param {(p: any) => string} o.colorOf     category colour of a post
 * @param {(p: any, seed?: string) => string} o.coverOf  the post's cover art as SVG
 * @param {Record<string, { short: string, open: boolean }>} o.licenses
 */
export function createOg({ site, colorOf, coverOf, licenses }) {
  const foot = `${site.blogTitle} · ${site.host}/blog`

  /** One post: its own colour, cover, title, summary, date and licence / DOI. */
  function post(p) {
    const lic = licenses[p.license]
    const kicker = [p.category, p.series ? `${p.series}${p.seriesPart ? ` · Part ${p.seriesPart}` : ''}` : '', `${p.minutes} min read`].filter(Boolean).join(' · ')
    const right = [p.updated && p.updated !== p.date ? `Updated ${fmtDate(p.updated)}` : fmtDate(p.date), p.doi ? `DOI ${p.doi}` : lic?.open ? `Open access · ${lic.short}` : p.level || '']
    return png(notebook({ kicker, color: colorOf(p), title: p.title, sub: p.description, art: coverOf(p), foot, right }))
  }

  /** The blog index: counts per category and the newest post. */
  function blog(posts, { title, description }) {
    const order = site.categories ?? []
    const counts = Object.entries(posts.reduce((m, p) => ((m[p.category] = (m[p.category] || 0) + 1), m), {})).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    const newest = posts[0]
    const lead = posts.find((p) => p.featured) ?? newest
    const latest = newest
      ? `<text x="80" y="452" font-family="Inter" font-weight="600" font-size="17" letter-spacing="2" fill="${colorOf(newest)}">LATEST</text>
  <text x="80" y="486" font-family="Source Serif 4" font-weight="600" font-size="28" fill="${INK}">${xml(fit(newest.title, 28, 900))}</text>`
      : ''
    return png(
      notebook({
        kicker: `${posts.length} posts · ${counts.map(([c]) => c).join(' · ')}`,
        color: '#d4834f',
        title,
        sub: description,
        art: lead ? coverOf({ ...lead, art: 'galaxy' }, 'notebook') : '',
        foot: `${site.host}/blog`,
        right: [newest ? `Updated ${fmtDate(posts.map((p) => p.updated ?? p.date).sort().at(-1))}` : '', 'RSS · JSON Feed · llms.txt'],
        extra: latest,
        top: 236,
      }),
    )
  }

  /** Research & citation: identity, open-access posts and the newest research titles. */
  function research(posts, { orcid }) {
    const open = posts.filter((p) => licenses[p.license]?.open)
    const recent = [...posts.filter((p) => p.category === 'AI Research'), ...open.filter((p) => p.category !== 'AI Research')].slice(0, 3)
    const list = recent
      .map(
        (p, i) => `<circle cx="88" cy="${383 + i * 40}" r="4" fill="#a6ce39"/>
  <text x="104" y="${390 + i * 40}" font-family="Inter" font-weight="500" font-size="23" fill="${MUTED}">${xml(fit(p.title, 23, 800))}</text>`,
      )
      .join('\n  ')
    return png(
      notebook({
        kicker: `Research & citation · ORCID ${orcid}`,
        color: '#a6ce39',
        title: 'Research and writing by Muhammad Gulzaib',
        sub: '',
        art: coverOf({ slug: 'research', art: 'network', category: 'AI Research' }, 'research'),
        foot,
        right: [`${open.length} open-access posts · CC BY 4.0`, 'APA · MLA · IEEE · BibTeX · RIS · PDF'],
        extra: list,
        top: 196,
      }),
    )
  }

  /** A blog series: title, subtitle, published/planned counts and the first part's cover. */
  function series(s, seriesPosts) {
    const first = seriesPosts[0]
    const total = s.plannedPostCount ?? seriesPosts.length
    return png(
      notebook({
        kicker: `Blog series · ${seriesPosts.length} of ${total} published`,
        color: first ? colorOf(first) : '#d4834f',
        title: s.title,
        sub: s.subtitle ?? s.description,
        art: first ? coverOf(first) : coverOf({ slug: `series-${s.slug}`, art: 'road', category: 'Founder' }, 'series'),
        foot,
        right: [s.stages?.length ? `${s.stages.length} stages` : '', s.cadence ?? ''],
      }),
    )
  }

  function notFound() {
    return png(notebook({ kicker: '404 · Page not found', color: '#d4834f', title: 'This page wandered off', sub: 'The notebook and the portfolio are still here.', foot, right: [site.host] }))
  }

  /** Generic template for any future page. */
  function page({ kicker, title, sub = '', color = '#d4834f', art = '', right = [] }) {
    return png(notebook({ kicker, color, title, sub, art, foot, right }))
  }

  /* --------------------------------------------- portfolio (landing page) */

  const LIME = '#c6ff3d'
  const DARK = '#07070a'
  const PERSON = dataUri('assets/og-person.png', 'image/png')

  /** The portfolio card: name, role, tagline, ventures and the newest note, photo on the lime disc. */
  function home({ profile, ventures, posts }) {
    const words = profile.name.toUpperCase().split(/\s+/)
    const last = words.pop()
    const first = words.join(' ')
    let nameSize = 88
    while (width(first || last, nameSize, { bold: true }) > 600 && nameSize > 60) nameSize -= 4
    const chips = []
    let x = 80
    for (const v of ventures) {
      const w = width(v.name, 20) + 46
      if (x + w > 640) break
      chips.push(`<rect x="${x}" y="470" width="${w.toFixed(0)}" height="40" rx="20" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.16"/>
  <circle cx="${x + 20}" cy="490" r="5" fill="${v.hue}"/>
  <text x="${x + 32}" y="497" font-family="Inter" font-weight="600" font-size="20" fill="#ecebe6">${xml(v.name)}</text>`)
      x += w + 10
    }
    const newest = posts[0]
    const cx = 891
    const cy = 318
    return png(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${LIME}" stop-opacity="0.9"/><stop offset="1" stop-color="${LIME}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${DARK}"/>
  <circle cx="${cx}" cy="${cy}" r="260" fill="url(#glow)" opacity="0.5"/>
  <circle cx="${cx}" cy="${cy}" r="205" fill="${LIME}"/>
  <image href="${PERSON}" x="623" y="30" width="537" height="600"/>
  <circle cx="86" cy="96" r="7" fill="${LIME}"/>
  <text x="104" y="104" font-family="Inter" font-weight="600" font-size="22" letter-spacing="3" fill="${LIME}">${xml(fit(profile.role.toUpperCase().replace(/\s*&\s*/g, ' · '), 22 * 1.15, 560))}</text>
  ${first ? `<text x="80" y="228" font-family="Inter" font-weight="900" font-size="${nameSize}" letter-spacing="-2" fill="#ecebe6" fill-opacity="0.32">${xml(first)}</text>` : ''}
  <text x="80" y="${first ? 228 + nameSize * 1.06 : 290}" font-family="Inter" font-weight="900" font-size="${nameSize}" letter-spacing="-2" fill="#ecebe6">${xml(last)}</text>
  <text x="80" y="392" font-family="Inter" font-weight="500" font-size="28" fill="#c9c9d1">${xml(fit(profile.tagline, 28, 560))}</text>
  <text x="80" y="432" font-family="Inter" font-weight="500" font-size="24" fill="#8d8d99">${xml(fit(profile.headline, 24, 560))}</text>
  ${chips.join('\n  ')}
  <text x="80" y="574" font-family="Inter" font-weight="800" font-size="24" fill="#ecebe6">${xml(site.host)}</text>
  ${newest ? `<text x="80" y="602" font-family="Inter" font-weight="500" font-size="18" fill="#8d8d99">${xml(fit(`Latest note: ${newest.title}`, 18, 540))}</text>` : ''}
</svg>`)
  }

  return { home, blog, post, research, series, notFound, page }
}
