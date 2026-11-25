/**
 * Featured images ("covers") for blog posts, rendered from a `cover:` block in the post's
 * frontmatter. One cover is used everywhere: blog cards, the post header, post-link cards,
 * "Keep reading", and (with a small brand pill) the post's Open Graph image.
 *
 *   node scripts/covers.mjs            writes public/covers/<slug>.webp (1200 wide) and <slug>-640.webp
 *   node scripts/covers.mjs --sheet    also writes public/covers/_sheet.webp, every cover on one page
 *
 * Each style is a strategy for earning the click (docs/COVERS.md has the reasoning):
 *
 *   number     one big, true number and what it cost            (code-is-not-a-business)
 *   versus     the thing people expect vs the thing that wins   (fee-vouchers-not-dashboards)
 *   code       the real code from the post, in an editor window (ai-features-in-laravel-…)
 *   image      AI illustration from assets/covers + a hook       (multi-tenant, rag-for-exam-generation)
 *   headline   giant typographic claim on a bold colour          (distribution-beats-features)
 *   quote      the line from the post that people remember       (simple-wins)
 *   face       the author's photo next to a two-line hook        (agents-that-do-work)
 *   list       "N steps" with the steps visible                  (how-i-write-technical-posts)
 *   mockup     the artifact the post teaches you to make         (readme-people-read)
 *   terminal   proof: real test output                           (school-erp-database-design)
 *
 * Posts without a `cover:` keep the generative dot art (src/blog/components/CoverArt.tsx).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { loadPosts, POSTS_DIR } from './blog.mjs'
import { xml, wrap, width, fit } from './og.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
export const W = 1200
export const H = 630
export { COVER_STYLES } from './blog.mjs'
const CATEGORY_COLOR = { Founder: '#d4834f', Engineering: '#5a84d6', 'AI Research': '#9a6fd1', Writing: '#3f9b78' }

/* ------------------------------------------------------------------ fonts */

const SERIF = 'Source Serif 4'
const SANS = 'Inter'
const MONO = 'JetBrains Mono'
const SANS_ = SANS
const SERIF_ = SERIF
const MONO_ = MONO
const FAM_DIR = { [SANS]: '/inter/', [SERIF]: '/source-serif-4/', [MONO]: '/jetbrains-mono/' }
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
  font('@expo-google-fonts/inter', '700'),
  font('@expo-google-fonts/inter', '800'),
  font('@expo-google-fonts/inter', '900'),
  font('@expo-google-fonts/jetbrains-mono', '500'),
  font('@expo-google-fonts/jetbrains-mono', '700'),
]
export const FONT_FILE = Object.fromEntries(
  [
    [SANS_, [500, 600, 700, 800, 900]],
    [SERIF_, [600, 700]],
    [MONO_, [500, 700]],
  ].flatMap(([fam, ws]) => ws.map((w) => [`${fam}|${w}`, fontFiles.find((f) => f.includes(FAM_DIR[fam]) && path.basename(path.dirname(f)).startsWith(String(w)))])),
)
const mcache = new Map()
/** Exact ink width of `s` (via resvg), measured once at 100px per string and scaled. */
export function measure(s, size, family = SANS_, weight = 600, ls = 0) {
  const key = `${family}|${weight}|${s}`
  if (!mcache.has(key)) {
    const file = FONT_FILE[`${family}|${weight}`]
    // fontFiles, not fontBuffers: resvg-js 2.6 silently ignores fontBuffers here and measures the wrong face
    const r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(400, s.length * 120)}" height="200"><text x="10" y="150" font-family="${family}" font-weight="${weight}" font-size="100" xml:space="preserve">${xml(s)}</text></svg>`, { font: { fontFiles: [file], loadSystemFonts: false } })
    const b = r.getBBox()
    mcache.set(key, b ? b.width : 0)
  }
  return (mcache.get(key) * size) / 100 + ls * Math.max(0, [...s].length - 1)
}
/** Greedy wrap using measured word widths. */
function wrapM(text, size, max, family = SANS_, weight = 600) {
  const space = measure('a a', 100, family, weight) - measure('aa', 100, family, weight)
  const out = []
  let line = []
  let w = 0
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const ww = measure(word, size, family, weight)
    const next = line.length ? w + (space * size) / 100 + ww : ww
    if (next > max && line.length) {
      out.push(line.join(' '))
      line = [word]
      w = ww
    } else {
      line.push(word)
      w = next
    }
  }
  if (line.length) out.push(line.join(' '))
  return out
}
// resvg ignores font-feature-settings, so JetBrains Mono would draw -> and => as arrows.
// Splitting the line into separately positioned <text> runs breaks the ligature (glyphs are 0.6em wide).
const noLig = (l) => {
  const out = []
  let start = 0
  for (const m of l.matchAll(/[-=](?=>)/g)) {
    out.push([start, l.slice(start, m.index + 1)])
    start = m.index + 1
  }
  out.push([start, l.slice(start)])
  return out.filter(([, seg]) => seg.length)
}
const render = (svg, w = W) => new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: w } }).render().asPng()

const monoW = (s, size) => [...String(s)].length * size * 0.6
const dataUri = (buf, type) => `data:${type};base64,${buf.toString('base64')}`
const AVATAR = dataUri(fs.readFileSync(path.join(root, 'public/img/gul/avatar-og.png')), 'image/png')
const PERSON = dataUri(fs.readFileSync(path.join(root, 'assets/og-person.png')), 'image/png')

/* ---------------------------------------------------------------- helpers */

const svgOpen = (bg, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${bg}`
const T = (x, y, s, { size = 24, family = SANS, weight = 600, fill = '#fff', anchor = 'start', ls = 0, opacity = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-weight="${weight}" font-size="${size}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''}>${xml(s)}</text>`
const lines = (arr, x, y, lh, opts) => arr.map((l, i) => T(x, (y + i * lh).toFixed(1), l, opts)).join('')
const kicker = (s, x, y, fill, size = 20) => (s ? T(x, y, String(s).toUpperCase(), { size, weight: 700, fill, ls: 3 }) : '')
/** Wrap at the largest size (from `sizes`) that fits in `maxLines`. */
function fitWrap(text, sizes, max, maxLines, family = SANS, weight = 600) {
  for (const size of sizes) {
    const l = wrapM(text, size, max, family, weight)
    if (l.length <= maxLines) return { size, l }
  }
  const size = sizes.at(-1)
  console.warn(`covers: "${text}" does not fit in ${maxLines} line(s); it was cut. Shorten it.`)
  return { size, l: wrapM(text, size, max, family, weight).slice(0, maxLines) }
}
/** Largest size ≤ `size` at which every line fits in `max`. */
function fitLines(arr, size, max, family = SANS, weight = 600, min = 30, ls = 0) {
  while (size > min && arr.some((t) => measure(t, size, family, weight, ls) > max)) size -= 2
  return size
}
const windowChrome = (x, y, w, h, { bg = '#0d1424', bar = '#151e33', stroke = '#2a3654', title = '', titleFill = '#8b97b3' } = {}) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>
  <path d="M${x} ${y + 16}a16 16 0 0 1 16 -16h${w - 32}a16 16 0 0 1 16 16v28h-${w}z" fill="${bar}"/>
  <circle cx="${x + 26}" cy="${y + 22}" r="7" fill="#ff5f57"/><circle cx="${x + 50}" cy="${y + 22}" r="7" fill="#febc2e"/><circle cx="${x + 74}" cy="${y + 22}" r="7" fill="#28c840"/>
  ${title ? T(x + w / 2, y + 29, title, { size: 17, family: MONO, weight: 500, fill: titleFill, anchor: 'middle' }) : ''}`
const shadow = (id = 'sh', o = 0.35, blur = 18) => `<filter id="${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="${blur}" flood-color="#000" flood-opacity="${o}"/></filter>`

/** Tiny PHP/SQL-ish highlighter → tspans. Good enough for a cover, not a parser. */
function highlight(line) {
  const KW = /^(public|private|protected|function|return|foreach|as|use|echo|new|class|if|else|fn|static|CREATE|TABLE|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UNIQUE|KEY|NOT|NULL|PRIMARY|FOREIGN|REFERENCES|CONSTRAINT|CHECK)$/
  const out = []
  const re = /('[^']*'|"[^"]*"|\$[A-Za-z_]\w*|\/\/.*$|--.*$|[A-Za-z_]\w*(?=\()|[A-Za-z_]\w*|\d+|\s+|.)/g
  for (const [tok] of line.matchAll(re)) {
    let c = '#d6deeb'
    if (/^['"]/.test(tok)) c = '#c3e88d'
    else if (/^\$/.test(tok)) c = '#82aaff'
    else if (/^(\/\/|--)/.test(tok)) c = '#6b7a99'
    else if (KW.test(tok)) c = '#c792ea'
    else if (/^\d+$/.test(tok)) c = '#f78c6c'
    else if (/^[A-Za-z_]\w*$/.test(tok) && line.slice(line.indexOf(tok) + tok.length).startsWith('(')) c = '#ffcb6b'
    out.push(`<tspan fill="${c}">${xml(tok)}</tspan>`)
  }
  return out.join('')
}

/* ---------------------------------------------------------------- styles */

const STYLES = {
  /** One big number, then what it meant. */
  number(c, p, a) {
    const big = String(c.big ?? '')
    let size = 330
    while (measure(big, size, SANS, 900, -8) > 560 && size > 150) size -= 10
    const bw = measure(big, size, SANS, 900, -8)
    const x = Math.round(Math.max(560, 48 + bw + 56))
    const max = W - x - 56
    const parts = c.lines ?? []
    const ls = fitLines(parts, 66, max, SERIF, 700, 40)
    const sub = c.sub ? wrapM(c.sub, 26, max, SANS, 500).slice(0, 3) : []
    const block = parts.length * ls * 1.1 + (sub.length ? 24 + sub.length * 36 : 0)
    const y0 = 330 - block / 2 + ls * 0.8
    return (
      svgOpen(
        `<rect width="${W}" height="${H}" fill="#1a120c"/><rect width="${W}" height="${H}" fill="url(#glow)"/>`,
        `<radialGradient id="glow" cx="0.25" cy="0.55" r="0.6"><stop offset="0" stop-color="${a}" stop-opacity="0.35"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
         <linearGradient id="num" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffc58f"/><stop offset="1" stop-color="${a}"/></linearGradient>`,
      ) +
      kicker(c.kicker, 64, 84, a) +
      `<text x="40" y="${330 + size * 0.36}" font-family="${SANS}" font-weight="900" font-size="${size}" letter-spacing="-8" fill="url(#num)">${xml(big)}</text>` +
      parts.map((t, i) => T(x, (y0 + i * ls * 1.1).toFixed(1), t, { size: ls, family: SERIF, weight: 700, fill: i === parts.length - 1 ? '#ffb27a' : '#fbf3ea' })).join('') +
      lines(sub, x, y0 + (parts.length - 1) * ls * 1.1 + 24 + 36, 36, { size: 26, weight: 500, fill: '#c9b6a6' }) +
      `</svg>`
    )
  },

  /** What people expect (faded, struck out) vs what actually wins. */
  versus(c, p, a) {
    const L = c.left ?? {}
    const R = c.right ?? {}
    const rows = R.rows ?? []
    const bars = [0.35, 0.6, 0.45, 0.8, 0.55, 0.7, 0.9]
    const chart = `
      <g opacity="0.5">
        <rect x="60" y="150" width="500" height="390" rx="18" fill="#ffffff" stroke="#d8d1c4"/>
        <rect x="90" y="180" width="140" height="70" rx="10" fill="#ece6db"/><rect x="245" y="180" width="140" height="70" rx="10" fill="#ece6db"/><rect x="400" y="180" width="130" height="70" rx="10" fill="#ece6db"/>
        ${bars.map((h, i) => `<rect x="${100 + i * 60}" y="${500 - h * 200}" width="36" height="${h * 200}" rx="6" fill="#b9b2a6"/>`).join('')}
        <polyline points="100,330 160,300 220,320 280,270 340,285 400,240 460,250 520,210" fill="none" stroke="#9c958a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <line x1="80" y1="170" x2="540" y2="520" stroke="#d64541" stroke-width="12" stroke-linecap="round" opacity="0.9"/>
      <line x1="540" y1="170" x2="80" y2="520" stroke="#d64541" stroke-width="12" stroke-linecap="round" opacity="0.9"/>`
    const vx = 640
    const vw = 500
    const lh = Math.min(40, 270 / Math.max(rows.length, 1))
    const voucher = `
      <g filter="url(#sh)">
        <rect x="${vx}" y="140" width="${vw}" height="410" rx="14" fill="#ffffff"/>
      </g>
      <rect x="${vx}" y="140" width="${vw}" height="62" rx="14" fill="${a}"/><rect x="${vx}" y="180" width="${vw}" height="22" fill="${a}"/>
      ${T(vx + 28, 182, R.heading ?? 'FEE VOUCHER', { size: 24, family: MONO, weight: 700, fill: '#fff', ls: 2 })}
      ${T(vx + vw - 28, 182, R.due ?? '', { size: 18, family: MONO, weight: 500, fill: '#fff', anchor: 'end', opacity: 0.9 })}
      ${rows
        .map(([k, v], i) => {
          const y = 244 + i * lh
          return `${T(vx + 28, y, fit(k, 21, 330), { size: 21, family: MONO, weight: 500, fill: '#3b352d' })}${T(vx + vw - 28, y, v, { size: 21, family: MONO, weight: 500, fill: String(v).startsWith('−') ? '#2e8b57' : '#3b352d', anchor: 'end' })}
          <line x1="${vx + 28}" y1="${y + 13}" x2="${vx + vw - 28}" y2="${y + 13}" stroke="#ece6db" stroke-dasharray="4 5"/>`
        })
        .join('')}
      <rect x="${vx + 20}" y="${470}" width="${vw - 40}" height="60" rx="10" fill="#f6f1e7"/>
      ${T(vx + 40, 510, R.totalLabel ?? 'Total due', { size: 24, family: MONO, weight: 700, fill: '#1e1b16' })}
      ${T(vx + vw - 40, 510, R.total ?? '', { size: 30, family: MONO, weight: 700, fill: '#1e1b16', anchor: 'end' })}
      <circle cx="${vx + vw - 6}" cy="148" r="34" fill="#2e9b62" stroke="#f4efe6" stroke-width="6"/>
      <path d="M${vx + vw - 22} 148l11 11 22 -24" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
    return (
      svgOpen(`<rect width="${W}" height="${H}" fill="#f4efe6"/>`, shadow('sh', 0.18, 16)) +
      T(310, 104, L.label ?? '', { size: 46, weight: 800, fill: '#9a9389', anchor: 'middle' }) +
      `<line x1="${310 - width(L.label ?? '', 46) / 2 - 6}" y1="88" x2="${310 + width(L.label ?? '', 46) / 2 + 6}" y2="88" stroke="#d64541" stroke-width="5"/>` +
      T(vx + vw / 2, 104, R.label ?? '', { size: 46, weight: 800, fill: '#1e1b16', anchor: 'middle' }) +
      chart +
      voucher +
      (c.sub ? T(W / 2, 600, c.sub, { size: 22, weight: 600, fill: '#6f675c', anchor: 'middle' }) : '') +
      `</svg>`
    )
  },

  /** The real code, in an editor window, with the line that matters lit up. */
  code(c, p, a) {
    const code = String(c.code ?? '').replace(/\s+$/, '').split('\n')
    const hl = new Set((c.highlight ?? []).map(Number))
    const { size: hs, l: hook } = fitWrap(c.hook ?? p.title, [56, 50, 46], 1080, 1, SANS, 800)
    const top = 190
    const wh = 400
    const fs_ = Math.min(22, Math.floor(1000 / Math.max(...code.map((l) => l.length), 40) / 0.6))
    const lh = Math.min(fs_ * 1.5, (wh - 90) / code.length)
    return (
      svgOpen(
        `<rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1100" cy="40" r="320" fill="${a}" opacity="0.18"/>`,
        `<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0c1428"/><stop offset="1" stop-color="#16284f"/></linearGradient>${shadow('sh', 0.5, 22)}`,
      ) +
      kicker(c.kicker, 64, 76, '#9db8ff') +
      lines(hook, 62, 140, hs * 1.1, { size: hs, weight: 800, fill: '#ffffff' }) +
      `<g filter="url(#sh)">${windowChrome(60, top, 1080, wh, { title: c.file ?? '' })}</g>` +
      code
        .map((l, i) => {
          const y = top + 80 + i * lh
          return `${hl.has(i + 1) ? `<rect x="61" y="${(y - lh * 0.72).toFixed(1)}" width="1078" height="${lh.toFixed(1)}" fill="${a}" opacity="0.22"/><rect x="61" y="${(y - lh * 0.72).toFixed(1)}" width="5" height="${lh.toFixed(1)}" fill="#9db8ff"/>` : ''}
          ${T(96, y.toFixed(1), String(i + 1).padStart(2, ' '), { size: fs_, family: MONO, weight: 500, fill: '#3d4a6b' })}
          ${noLig(l).map(([col, seg]) => `<text x="${(140 + col * fs_ * 0.6).toFixed(1)}" y="${y.toFixed(1)}" font-family="${MONO}" font-weight="500" font-size="${fs_}" xml:space="preserve">${highlight(seg)}</text>`).join('')}`
        })
        .join('') +
      (c.badge ? `<rect x="${1140 - monoW(c.badge, 16) - 44}" y="${top + 8}" width="${monoW(c.badge, 16) + 28}" height="28" rx="14" fill="#1f3a2c" stroke="#3fbf7f"/>${T(1140 - 30, top + 27, c.badge, { size: 16, family: MONO, weight: 700, fill: '#7ee2a8', anchor: 'end' })}` : '') +
      `</svg>`
    )
  },

  /** An AI illustration (assets/covers/<file>) with a hook over a soft gradient. */
  image(c, p, a, ctx) {
    const tw = c.textWidth ?? 540
    let size, l
    if (c.hookLines) {
      l = c.hookLines
      size = fitLines(l, 68, tw, SERIF, 700, 40)
    } else ({ size, l } = fitWrap(c.hook ?? p.title, [66, 60, 54, 48], tw, 3, SERIF, 700))
    const subFam = c.subMono ? MONO : SANS
    const sub = c.sub ? wrapM(c.sub, 24, tw, subFam, 500).slice(0, 2) : []
    const block = l.length * size * 1.08 + (sub.length ? 28 + sub.length * 34 : 0)
    const y0 = Math.max(170, (H - block) / 2 + size * 0.75)
    const tint = c.tint ?? '#0b1020'
    return (
      svgOpen(
        `<rect width="${W}" height="${H}" fill="${ctx.bg ?? tint}"/>` +
          (ctx.inset < 1
            ? `<image href="${ctx.image}" x="${ctx.box.x}" y="${ctx.box.y}" width="${ctx.box.w}" height="${ctx.box.h}" mask="url(#edge)"/>`
            : `<image href="${ctx.image}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`) +
          `<rect width="${W}" height="${H}" fill="url(#fade)"/>`,
        `<linearGradient id="fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${tint}" stop-opacity="${ctx.inset < 1 ? 0.6 : 0.92}"/><stop offset="0.4" stop-color="${tint}" stop-opacity="${ctx.inset < 1 ? 0.3 : 0.7}"/><stop offset="0.58" stop-color="${tint}" stop-opacity="0"/></linearGradient>
         <linearGradient id="ex" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.3" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient>
         <linearGradient id="ey" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="0.22" stop-color="#000" stop-opacity="0"/><stop offset="0.78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient>
         <mask id="edge" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="${ctx.box?.x ?? 0}" y="${ctx.box?.y ?? 0}" width="${ctx.box?.w ?? W}" height="${ctx.box?.h ?? H}" fill="url(#ex)"/><rect x="${ctx.box?.x ?? 0}" y="${ctx.box?.y ?? 0}" width="${ctx.box?.w ?? W}" height="${ctx.box?.h ?? H}" fill="url(#ey)"/></mask>`,
      ) +
      kicker(c.kicker, 64, 84, c.kickerColor ?? a) +
      lines(l, 62, y0, size * 1.08, { size, family: SERIF, weight: 700, fill: '#ffffff' }) +
      lines(sub, 64, y0 + (l.length - 1) * size * 1.08 + 28 + 32, 34, { size: 24, family: subFam, weight: 500, fill: c.subColor ?? '#d5dcf0' }) +
      `</svg>`
    )
  },

  /** A giant typographic claim on a saturated colour. */
  headline(c, p, a) {
    const L = c.lines ?? [p.title]
    let y = 230
    const out = []
    for (const ln of L) {
      const t = typeof ln === 'string' ? { text: ln } : ln
      if (t.y) y = Number(t.y)
      let size = t.size ?? 130
      const fam = t.serif ? SERIF : SANS
      const wt = t.serif ? 700 : 900
      const lsp = t.serif ? 0 : -3
      while (measure(t.text, size, fam, wt, lsp) > (t.max ?? 820) && size > 50) size -= 4
      out.push(T(60, y, t.text, { size, family: fam, weight: wt, fill: t.color ?? '#ffffff', ls: lsp, opacity: t.strike ? 0.6 : 1 }))
      if (t.strike) out.push(`<rect x="54" y="${y - size * 0.36}" width="${measure(t.text, size, fam, wt, lsp) + 16}" height="${Math.max(8, size * 0.09)}" fill="${t.strikeColor ?? '#2a0d04'}"/>`)
      y += size * (t.serif ? 0.95 : 1.0)
    }
    return (
      svgOpen(
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>
         <g transform="translate(905 110) rotate(14)" opacity="0.16"><rect width="230" height="420" rx="40" fill="none" stroke="#fff" stroke-width="18"/><rect x="85" y="28" width="60" height="10" rx="5" fill="#fff"/><circle cx="115" cy="380" r="18" fill="none" stroke="#fff" stroke-width="10"/></g>`,
        `<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${c.from ?? '#ff7a3d'}"/><stop offset="1" stop-color="${c.to ?? '#d93a2b'}"/></linearGradient>`,
      ) +
      kicker(c.kicker, 64, 84, '#fff3ea') +
      out.join('') +
      (c.sub ? T(64, 585, c.sub, { size: 24, weight: 600, fill: '#fff3ea', opacity: 0.9 }) : '') +
      `</svg>`
    )
  },

  /** The line people remember, set big. */
  quote(c, p, a) {
    const { size, l } = fitWrap(`“${c.quote}”`, [80, 74, 68, 62, 56], 1000, 3, SERIF, 700)
    const y0 = 340 - ((l.length - 1) * size * 1.12) / 2
    return (
      svgOpen(`<rect width="${W}" height="${H}" fill="#f6f1e7"/><rect x="0" y="0" width="14" height="${H}" fill="${a}"/>`) +
      `<text x="40" y="380" font-family="${SERIF}" font-weight="700" font-size="520" fill="${a}" opacity="0.13">“</text>` +
      kicker(c.kicker, 96, 84, a) +
      lines(l, 92, y0, size * 1.12, { size, family: SERIF, weight: 700, fill: '#1d1a16' }) +
      `<rect x="96" y="${y0 + (l.length - 1) * size * 1.12 + 52}" width="44" height="4" fill="${a}"/>` +
      T(156, y0 + (l.length - 1) * size * 1.12 + 62, c.by ?? '', { size: 26, weight: 600, fill: '#6f6456' }) +
      `</svg>`
    )
  },

  /** The author's face (eyes pull eyes) next to a two-line hook. */
  face(c, p, a) {
    const L = c.lines ?? [p.title]
    const size = fitLines(L, 80, 560, SANS, 900, 44, -2)
    const sub = c.sub ? wrapM(c.sub, 26, 540, SANS, 500).slice(0, 3) : []
    const y0 = 250 - (L.length - 2) * size * 0.5
    return (
      svgOpen(
        `<rect width="${W}" height="${H}" fill="#120f1c"/><circle cx="900" cy="330" r="300" fill="url(#glow)"/><circle cx="900" cy="330" r="215" fill="${a}"/>`,
        `<radialGradient id="glow"><stop offset="0" stop-color="${a}" stop-opacity="0.55"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>`,
      ) +
      `<image href="${PERSON}" x="632" y="30" width="537" height="600"/>` +
      kicker(c.kicker, 64, 84, '#c7a6ff') +
      L.map((t, i) => T(60, (y0 + i * size * 1.05).toFixed(1), t, { size, weight: 900, fill: i % 2 ? '#c7a6ff' : '#ffffff', ls: -2 })).join('') +
      lines(sub, 64, y0 + (L.length - 1) * size * 1.05 + 70, 36, { size: 26, weight: 500, fill: '#bdb3d1' }) +
      `</svg>`
    )
  },

  /** "N steps" with the steps visible. */
  list(c, p, a) {
    const items = c.items ?? []
    const rowH = Math.min(66, 440 / Math.max(items.length, 1))
    const { size: ts, l: title } = fitWrap(c.hook ?? '', [46, 42, 38], 420, 3, SERIF, 700)
    return (
      svgOpen(`<rect width="${W}" height="${H}" fill="#e9f2ed"/>`, shadow('sh', 0.12, 14)) +
      kicker(c.kicker, 64, 84, '#2c7a59') +
      `<text x="48" y="345" font-family="${SANS}" font-weight="900" font-size="300" letter-spacing="-10" fill="${a}">${xml(c.big ?? items.length)}</text>` +
      lines(title, 64, 420, ts * 1.12, { size: ts, family: SERIF, weight: 700, fill: '#14281f' }) +
      `<g filter="url(#sh)"><rect x="540" y="60" width="600" height="${items.length * rowH + 50}" rx="20" fill="#ffffff"/></g>` +
      items
        .map((t, i) => {
          const y = 60 + 25 + i * rowH + rowH / 2
          return `<circle cx="${590}" cy="${y}" r="17" fill="${a}"/><path d="M${581} ${y}l6 6 11 -12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          ${T(624, y + 9, `${i + 1}. ${t}`, { size: 27, weight: 600, fill: '#1c2e25' })}
          ${i < items.length - 1 ? `<line x1="580" y1="${y + rowH / 2}" x2="1100" y2="${y + rowH / 2}" stroke="#e3ece7"/>` : ''}`
        })
        .join('') +
      `</svg>`
    )
  },

  /** The artifact the post teaches you to make (here: a README). */
  mockup(c, p, a) {
    const secs = c.sections ?? []
    const { size: hs, l: hook } = fitWrap(c.hook ?? '', [60, 56, 52, 48], 400, 3, SANS, 800)
    const colors = ['#f78166', '#d2a8ff', '#7ee787', '#79c0ff']
    const x = 520
    const sy = 230
    const sh = Math.min(84, 330 / Math.max(secs.length, 1))
    return (
      svgOpen(`<rect width="${W}" height="${H}" fill="#0d1117"/><circle cx="160" cy="560" r="260" fill="${a}" opacity="0.14"/>`, shadow('sh', 0.6, 24)) +
      kicker(c.kicker, 64, 84, '#7ee787') +
      lines(hook, 62, 300 - ((hook.length - 1) * hs * 1.1) / 2, hs * 1.1, { size: hs, weight: 800, fill: '#f0f6fc' }) +
      `<g filter="url(#sh)">${windowChrome(x, 50, 630, 530, { bg: '#161b22', bar: '#1f2630', stroke: '#30363d', title: c.file ?? 'README.md', titleFill: '#8b949e' })}</g>` +
      T(x + 40, 140, c.repo ?? 'your-project', { size: 38, weight: 800, fill: '#f0f6fc' }) +
      (() => {
        let bx = x + 40
        return (c.badges ?? [['build', 'passing', '#2ea043'], ['license', 'MIT', '#1f6feb'], ['docs', `${secs.length} sections`, '#8957e5']]).map(([k, v, col]) => {
          const kw = measure(k, 15) + 16
          const vw = measure(v, 15) + 16
          const at = bx
          bx += kw + vw + 12
          return [at, k, v, col, kw, vw]
        })
      })()
        .map(([bx, k, v, col, kw, vw]) => {
          return `<rect x="${bx}" y="160" width="${kw}" height="26" rx="4" fill="#444c56"/><rect x="${bx + kw}" y="160" width="${vw}" height="26" rx="4" fill="${col}"/><rect x="${bx + kw}" y="160" width="6" height="26" fill="${col}"/>${T(bx + 8, 178, k, { size: 15, weight: 600, fill: '#fff' })}${T(bx + kw + 8, 178, v, { size: 15, weight: 600, fill: '#fff' })}`
        })
        .join('') +
      `<line x1="${x + 40}" y1="206" x2="${x + 590}" y2="206" stroke="#30363d"/>` +
      secs
        .map((t, i) => {
          const y = sy + i * sh
          return `<rect x="${x + 40}" y="${y + 6}" width="34" height="34" rx="8" fill="${colors[i % 4]}"/>${T(x + 57, y + 31, String(i + 1), { size: 20, weight: 800, fill: '#0d1117', anchor: 'middle' })}
          ${T(x + 92, y + 32, t, { size: 28, weight: 700, fill: '#f0f6fc' })}
          <rect x="${x + 92}" y="${y + 48}" width="${300 + ((i * 97) % 140)}" height="9" rx="4.5" fill="#30363d"/><rect x="${x + 92}" y="${y + 64}" width="${200 + ((i * 53) % 120)}" height="9" rx="4.5" fill="#262c35"/>`
        })
        .join('') +
      `</svg>`
    )
  },

  /** Proof: real test output in a terminal. */
  terminal(c, p, a) {
    const out = c.lines ?? []
    const { size: hs, l: hook } = fitWrap(c.hook ?? p.title, [54, 50, 46, 42, 40], 1080, 1, SANS, 800)
    const top = 182
    const fs_ = 23
    const lh = 42
    const wh = Math.min(410, 70 + (out.length + 2) * lh + 40)
    const check = (x, y) => `<path d="M${x} ${y - 8}l6 6 12 -13" fill="none" stroke="#3fdc84" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
    const ry = top + 86 + (out.length + 1) * lh + 8
    return (
      svgOpen(
        `<rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1120" cy="${H}" r="360" fill="#2ea043" opacity="0.08"/>`,
        `<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#08101e"/><stop offset="1" stop-color="#0f1d36"/></linearGradient>${shadow('sh', 0.55, 22)}`,
      ) +
      kicker(c.kicker, 64, 76, '#7fb2ff') +
      lines(hook, 62, 138, hs * 1.1, { size: hs, weight: 800, fill: '#ffffff' }) +
      `<g filter="url(#sh)">${windowChrome(60, top, 1080, wh, { bg: '#060b14', bar: '#111a2b', stroke: '#24324d', title: c.title ?? 'bash' })}</g>` +
      `<text x="96" y="${top + 86}" font-family="${MONO}" font-weight="500" font-size="${fs_}" xml:space="preserve"><tspan fill="#7ee2a8">$ </tspan><tspan fill="#e6edf3">${xml(c.command ?? '')}</tspan></text>` +
      out
        .map((l, i) => {
          const y = top + 86 + (i + 1) * lh
          const ok = /^[✓√]/.test(l)
          return `${ok ? check(116, y) : ''}<text x="150" y="${y}" font-family="${MONO}" font-weight="500" font-size="${fs_}" fill="#c9d4e5" xml:space="preserve">${xml(ok ? l.slice(1).trim() : l)}</text>`
        })
        .join('') +
      (c.result
        ? `<text x="96" y="${ry}" font-family="${MONO}" font-weight="700" font-size="${fs_ + 7}" fill="#3fdc84">${xml(c.result)}</text>
           <rect x="${96 + monoW(c.result, fs_ + 7) + 12}" y="${ry - (fs_ + 7) * 0.8}" width="${(fs_ + 7) * 0.6}" height="${(fs_ + 7) * 0.95}" fill="#3fdc84" opacity="0.85"/>`
        : '') +
      `</svg>`
    )
  },
}

/* ------------------------------------------------------------- rendering */

/** Small brand pill for share images, bottom right. */
function brandPill(svg, side = 'right') {
  const label = 'Gul’s Notebook · gulzaib.vercel.app'
  const w = width(label, 19) + 74
  const x = side === 'left' ? 28 : W - w - 28
  const y = H - 68
  const pill = `<clipPath id="bav"><circle cx="${x + 26}" cy="${y + 20}" r="15"/></clipPath>
    <rect x="${x}" y="${y}" width="${w}" height="40" rx="20" fill="#0b0b0f" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.18"/>
    <image href="${AVATAR}" x="${x + 11}" y="${y + 5}" width="30" height="30" clip-path="url(#bav)"/>
    ${T(x + 50, y + 27, label, { size: 19, weight: 600, fill: '#f2eee6' })}`
  return svg.replace(/<\/svg>$/, `${pill}</svg>`)
}

const imageCache = new Map()
async function contextFor(p) {
  const c = p.cover
  if (c.style !== 'image') return {}
  const file = path.join(root, 'assets/covers', c.file ?? `${p.slug}.png`)
  const key = `${file}|${c.inset ?? 1}`
  if (!imageCache.has(key)) {
    const inset = Number(c.inset ?? 1)
    const img = sharp(file)
    const meta = await img.metadata()
    // background colour = the image's own top-left corner, so an inset picture blends in
    const { channels } = await sharp(file).extract({ left: 4, top: 4, width: 24, height: 24 }).stats()
    const bg = `#${channels.slice(0, 3).map((ch) => Math.round(ch.mean).toString(16).padStart(2, '0')).join('')}`
    let buf
    let box = { x: 0, y: 0, w: W, h: H }
    if (inset < 1) {
      const h = Math.round(H * inset)
      const w = Math.round((meta.width / meta.height) * h)
      box = { x: W - w + Math.round(w * 0.04), y: Math.round((H - h) / 2), w, h }
      buf = await sharp(file).resize(w * 2, h * 2).jpeg({ quality: 88 }).toBuffer()
    } else buf = await sharp(file).resize(W * 2, H * 2, { fit: 'cover', position: c.position ?? 'centre' }).jpeg({ quality: 88 }).toBuffer()
    imageCache.set(key, { image: dataUri(buf, 'image/jpeg'), bg, box, inset })
  }
  return imageCache.get(key)
}

/** The cover's SVG source, or null when the post has no `cover:`. */
export async function coverSvg(p, { brand = false } = {}) {
  const c = p.cover
  if (!c || !STYLES[c.style]) return null
  const accent = c.accent ?? CATEGORY_COLOR[p.category] ?? '#d4834f'
  const svg = STYLES[c.style](c, p, accent, await contextFor(p))
  // the versus caption sits bottom-centre, so its pill moves to the empty bottom-left corner
  return brand ? brandPill(svg, c.style === 'versus' ? 'left' : 'right') : svg
}

/** PNG buffer (for the OG image), or null. */
export async function coverPng(p, opts = { brand: true }) {
  const svg = await coverSvg(p, opts)
  return svg ? render(svg) : null
}

/** Writes public/covers/<slug>.webp and <slug>-640.webp for every post with a cover. */
export async function writeCovers({ dir = path.join(root, 'public/covers'), sheet = false } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const posts = loadPosts(POSTS_DIR, { includeDrafts: true }).filter((p) => p.cover)
  const keep = new Set()
  const pngs = []
  // A cover is re-rendered only when its inputs change: the front matter block, this script, or its image.
  const manifestFile = path.join(dir, 'manifest.json')
  const old = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}
  const next = {}
  const self = fs.readFileSync(fileURLToPath(import.meta.url))
  let rendered = 0
  for (const p of posts) {
    const h = createHash('sha1').update(self).update(JSON.stringify(p.cover)).update(p.title).update(p.category)
    if (p.cover.style === 'image') h.update(fs.readFileSync(path.join(root, 'assets/covers', p.cover.file ?? `${p.slug}.png`)))
    next[p.slug] = h.digest('hex').slice(0, 10)
    const outs = [[W, ''], [640, '-640']].map(([w, suffix]) => [w, path.join(dir, `${p.slug}${suffix}.webp`)])
    outs.forEach(([, o]) => keep.add(path.basename(o)))
    const fresh = old[p.slug] === next[p.slug] && outs.every(([, o]) => fs.existsSync(o))
    if (fresh && !sheet) continue
    const buf = render(await coverSvg(p), W * 2)
    pngs.push([p, buf])
    if (fresh) continue
    rendered++
    for (const [w, out] of outs) await sharp(buf).resize(w).webp({ quality: 84, effort: 5 }).toFile(out)
  }
  fs.writeFileSync(manifestFile, JSON.stringify(next, null, 2) + '\n')
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.webp') && !keep.has(f) && !f.startsWith('_')) fs.rmSync(path.join(dir, f))
  if (sheet && pngs.length) {
    const cw = 600
    const ch = 315 + 44
    const cols = 2
    const rows = Math.ceil(pngs.length / cols)
    const tiles = await Promise.all(pngs.map(([, b]) => sharp(b).resize(cw).png().toBuffer()))
    const labels = pngs.map(([p], i) => {
      const x = (i % cols) * (cw + 24) + 24
      const y = Math.floor(i / cols) * (ch + 24) + 24 + 315 + 30
      return T(x, y, `${i + 1}. ${p.cover.style}: ${fit(p.slug, 18, cw - 140)}`, { size: 18, weight: 600, fill: '#222' })
    })
    const sw = cols * (cw + 24) + 24
    const shh = rows * (ch + 24) + 24
    const base = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${shh}"><rect width="100%" height="100%" fill="#f3f1ec"/></svg>`)).png().toBuffer()
    const labelPng = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${shh}" viewBox="0 0 ${sw} ${shh}">${labels.join('')}</svg>`, sw)
    await sharp(base)
      .composite([...tiles.map((t, i) => ({ input: t, left: (i % cols) * (cw + 24) + 24, top: Math.floor(i / cols) * (ch + 24) + 24 })), { input: labelPng, left: 0, top: 0 }])
      .webp({ quality: 82 })
      .toFile(path.join(dir, '_sheet.webp'))
  }
  return { slugs: posts.map((p) => p.slug), rendered, versions: next }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const t = Date.now()
  const { slugs, rendered } = await writeCovers({ sheet: process.argv.includes('--sheet') })
  console.log(`covers: ${slugs.length} posts, ${rendered} rendered, ${slugs.length - rendered} unchanged (${Date.now() - t} ms)`)
}
