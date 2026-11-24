/**
 * Link metadata fetcher shared by the build (scripts/link-previews.mjs), the
 * dev server and the runtime fallback (api/link-preview.js).
 *
 * Safety (the runtime endpoint takes a URL from the browser):
 *  - http(s) on the default ports only, no credentials in the URL
 *  - every DNS answer is checked inside the socket's own lookup, so private,
 *    loopback, link-local and metadata addresses can't be reached, not even via
 *    redirects or DNS rebinding
 *  - at most 5 redirects, a hard timeout, and a byte cap on every response
 *  - only the extracted metadata is returned, never the raw page
 */
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'

export const UA = 'Mozilla/5.0 (compatible; GulLinkPreview/1.1; +https://gulzaib.vercel.app/blog)'
/** Second try for sites that turn away anything that looks like a bot (still names itself). */
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 GulLinkPreview/1.1'
const TEXTUAL = /html|xml|json|text\/|javascript|csv/

/* ------------------------------------------------------------ safe fetch */

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIp(mapped[1])
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith('64:ff9b:') || v.startsWith('2001:db8')
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err)
    const list = Array.isArray(address) ? address : [{ address, family }]
    if (!list.length || list.some((x) => isPrivateIp(x.address))) {
      return callback(Object.assign(new Error(`blocked address for ${hostname}`), { code: 'EBLOCKED' }))
    }
    if (Array.isArray(address)) callback(null, list)
    else callback(null, address, family)
  })
}

export function checkUrl(input) {
  let u
  try {
    u = new URL(input)
  } catch {
    throw Object.assign(new Error('invalid url'), { code: 'EINVAL' })
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw Object.assign(new Error('unsupported protocol'), { code: 'EINVAL' })
  if (u.username || u.password) throw Object.assign(new Error('credentials not allowed'), { code: 'EINVAL' })
  if (u.port && u.port !== '80' && u.port !== '443') throw Object.assign(new Error('port not allowed'), { code: 'EINVAL' })
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !net.isIP(host)) throw Object.assign(new Error('bare hostnames not allowed'), { code: 'EINVAL' })
  if (/(^|\.)(localhost|local|internal|localdomain)$/i.test(host)) throw Object.assign(new Error('host not allowed'), { code: 'EBLOCKED' })
  if (net.isIP(host) && isPrivateIp(host)) throw Object.assign(new Error('address not allowed'), { code: 'EBLOCKED' })
  return u
}

/**
 * GET a URL with the safety rules above. Resolves { url, status, type, body }
 * (body is a Buffer truncated to `max` bytes). Follows redirects itself.
 */
export function safeGet(input, { accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', max = 400_000, binaryMax = 65_536, timeout = 7000, redirects = 5, headers = {} } = {}) {
  const deadline = Date.now() + timeout
  const hop = (url, left) =>
    new Promise((resolve, reject) => {
      let u
      try {
        u = checkUrl(url)
      } catch (e) {
        return reject(e)
      }
      const lib = u.protocol === 'https:' ? https : http
      const remaining = Math.max(500, deadline - Date.now())
      const req = lib.request(
        u,
        {
          method: 'GET',
          lookup: safeLookup,
          headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'en;q=1, *;q=0.5', 'Accept-Encoding': 'gzip, deflate, br', ...headers },
          timeout: remaining,
        },
        (res) => {
          const status = res.statusCode ?? 0
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume()
            if (left <= 0) return reject(Object.assign(new Error('too many redirects'), { code: 'EREDIRECT' }))
            return resolve(hop(new URL(res.headers.location, u).href, left - 1))
          }
          const type = String(res.headers['content-type'] || '').toLowerCase()
          // files: read just enough to sniff them (image size etc.), never the whole thing
          const cap = !type || TEXTUAL.test(type) ? max : Math.min(max, binaryMax)
          const range = String(res.headers['content-range'] || '').match(/\/(\d+)$/)
          const length = range ? Number(range[1]) : Number(res.headers['content-length']) || undefined
          let stream = res
          const enc = String(res.headers['content-encoding'] || '').toLowerCase()
          if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip())
          else if (enc === 'deflate') stream = res.pipe(zlib.createInflate())
          else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress())
          const chunks = []
          let size = 0
          let done = false
          const finish = () => {
            if (done) return
            done = true
            clearTimeout(timer)
            resolve({ url: u.href, status, type, length, headers: res.headers, body: Buffer.concat(chunks) })
          }
          stream.on('data', (c) => {
            size += c.length
            chunks.push(c)
            if (size >= cap) {
              finish()
              req.destroy()
            }
          })
          stream.on('end', finish)
          stream.on('error', (e) => (size > 0 ? finish() : reject(e)))
        },
      )
      const timer = setTimeout(() => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), remaining)
      req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })))
      req.on('error', (e) => {
        clearTimeout(timer)
        reject(e)
      })
      req.end()
    })
  return hop(input, redirects)
}

/* ---------------------------------------------------------------- parsing */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™' }
export const decode = (s = '') =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENT[e.toLowerCase()] ?? m
  })

const clean = (s, max) => {
  if (!s) return undefined
  const t = decode(String(s)).replace(/<[^>]+>/g, ' ').replace(/\u00ad|(?<=\p{L})\u00ac(?=\p{L})/gu, '').replace(/[\u2b50\u2b51\u2729-\u2730]\ufe0f?/g, '★').replace(/\s+/g, ' ').trim()
  if (!t) return undefined
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t
}

function attrs(tag) {
  const out = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '')
  }
  return out
}

const abs = (href, base) => {
  try {
    const u = new URL(href, base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}

/** Decode a page with its declared charset (header, BOM or <meta charset>), UTF-8 otherwise. */
export function decodeBody(buf, type = '') {
  let label = type.match(/charset=["']?([\w.:-]+)/i)?.[1]
  if (!label) {
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) label = 'utf-8'
    else if (buf[0] === 0xff && buf[1] === 0xfe) label = 'utf-16le'
    else if (buf[0] === 0xfe && buf[1] === 0xff) label = 'utf-16be'
    else {
      const head = buf.subarray(0, 4096).toString('latin1')
      label = head.match(/<meta[^>]+charset=["']?\s*([\w.:-]+)/i)?.[1]
    }
  }
  try {
    return new TextDecoder(label || 'utf-8').decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

/** "1.4 MB" */
export const fmtBytes = (n) => (!n ? undefined : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** Width × height from the first bytes of a PNG, GIF, WebP or JPEG. */
export function imageSize(b) {
  try {
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
    if (b.toString('latin1', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) }
    if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
      const chunk = b.toString('latin1', 12, 16)
      if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }
      if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
      if (chunk === 'VP8L') {
        const n = b.readUInt32LE(21)
        return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }
      }
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null
        const m = b[i + 1]
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }
        i += 2 + b.readUInt16BE(i + 2)
      }
    }
  } catch {
    /* truncated */
  }
  return null
}

/** ISO 8601 duration (PT1H2M3S) → "1:02:03" */
const fmtDuration = (iso) => {
  const m = String(iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!m) return undefined
  const h = Number(m[1] || 0) * 24 + Number(m[2] || 0)
  const min = Number(m[3] || 0)
  const sec = Math.round(Number(m[4] || 0))
  if (!h && !min && !sec) return undefined
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`
}

const LD_KIND = {
  Article: 'article', NewsArticle: 'article', BlogPosting: 'article', TechArticle: 'article', ScholarlyArticle: 'paper', Report: 'article',
  VideoObject: 'video', Movie: 'video', AudioObject: 'audio', PodcastEpisode: 'audio', MusicRecording: 'audio',
  Product: 'product', SoftwareApplication: 'product', MobileApplication: 'product', WebApplication: 'product', Book: 'product', Course: 'product',
  Person: 'profile', ProfilePage: 'profile', Event: 'event', Recipe: 'article', SocialMediaPosting: 'social', DiscussionForumPosting: 'social',
}
const ldText = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? ldText(v[0]) : v && typeof v === 'object' ? v.name || v['@value'] || v.url : undefined)
const ldImage = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? ldImage(v[0]) : v && typeof v === 'object' ? v.url || v.contentUrl : undefined)
const currency = (amount, code) => {
  const n = Number(amount)
  if (!Number.isFinite(n)) return undefined
  if (n === 0) return 'Free'
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code || 'USD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
  } catch {
    return `${n} ${code || ''}`.trim()
  }
}

/** The most useful schema.org node on the page (JSON-LD), flattened into preview fields. */
function readJsonLd(html) {
  const nodes = []
  for (const m of html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (nodes.length > 40 || m[1].length > 200_000) break
    try {
      const walk = (v) => {
        if (Array.isArray(v)) v.forEach(walk)
        else if (v && typeof v === 'object') {
          nodes.push(v)
          if (v['@graph']) walk(v['@graph'])
          if (v.mainEntity && typeof v.mainEntity === 'object') walk(v.mainEntity)
        }
      }
      walk(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, '')))
    } catch {
      /* invalid JSON-LD is common */
    }
  }
  const typeOf = (n) => [].concat(n['@type'] || []).find((t) => LD_KIND[t])
  const node = nodes.find((n) => typeOf(n) && typeOf(n) !== 'Person' && typeOf(n) !== 'ProfilePage') || nodes.find(typeOf)
  if (!node) return null
  const type = typeOf(node)
  const offer = [].concat(node.offers || [])[0]
  const rating = node.aggregateRating
  const authors = [].concat(node.author || node.creator || []).map(ldText).filter(Boolean)
  return {
    type,
    kind: LD_KIND[type],
    title: ldText(node.headline) || ldText(node.name),
    description: ldText(node.description) || ldText(node.abstract),
    image: ldImage(node.image) || ldImage(node.thumbnailUrl),
    authors,
    published: ldText(node.datePublished) || ldText(node.uploadDate) || ldText(node.startDate),
    duration: fmtDuration(node.duration),
    price: offer ? currency(offer.price ?? offer.lowPrice, offer.priceCurrency) : undefined,
    rating: rating?.ratingValue ? `★ ${Number(rating.ratingValue).toFixed(1).replace(/\.0$/, '')}${rating.reviewCount || rating.ratingCount ? ` (${fmtCount(Number(rating.reviewCount || rating.ratingCount))})` : ''}` : undefined,
    place: type === 'Event' ? ldText(node.location) : undefined,
  }
}

/** First real heading and paragraph of the page body (for pages without meta tags). */
function bodyText(html) {
  const body = html.slice(Math.max(0, html.search(/<body\b/i)))
  // only the page's own content: banners, promos and chrome live outside <main>/<article>
  const main = body.match(/<(main|article)\b[\s\S]*?<\/\1>/i)?.[0]
  const strip = (x) =>
    x
      .replace(/<(script|style|noscript|svg|template|nav|header|footer|form|aside|dialog)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(div|section)\b[^>]*(?:class|id|role)=["'][^"']*(banner|notice|cookie|consent|donat|promo|alert|announce|newsletter|modal)[^"']*["'][\s\S]*?<\/\1>/gi, ' ')
  const h1 = strip(body).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  let para
  for (const m of main ? strip(main).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) : []) {
    const t = clean(m[1], 400)
    if (t && t.length >= 60 && !/cookie|javascript|browser is not supported|sign in|log in|donat|your support|subscribe/i.test(t)) {
      para = t
      break
    }
  }
  return { h1: clean(h1, 180), para }
}

/** Extract preview metadata from an HTML document. */
export function parseHtml(html, baseUrl) {
  const headEnd = html.search(/<\/head\s*>/i)
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 300_000)
  const meta = {}
  const multi = { 'citation_author': [], 'article:author': [] }
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0])
    const key = (a.property || a.name || a.itemprop || '').toLowerCase()
    if (!key || a.content == null) continue
    if (key in multi) multi[key].push(a.content)
    if (!(key in meta)) meta[key] = a.content
  }
  let base = baseUrl
  const baseTag = head.match(/<base\b[^>]*>/i)
  if (baseTag) base = abs(attrs(baseTag[0]).href || '', baseUrl) || baseUrl
  const icons = []
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0])
    const rel = (a.rel || '').toLowerCase()
    if (!/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel) || !a.href) continue
    const href = abs(a.href, base)
    if (href) icons.push({ href, rel, sizes: (a.sizes || '').toLowerCase(), type: (a.type || '').toLowerCase() })
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const lang = html.match(/<html\b[^>]*\blang=["']?([a-zA-Z-]+)/i)?.[1]
  const pick = (...keys) => keys.map((k) => meta[k]).find((v) => v && v.trim())
  let image = abs(pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src') || '', base)
  // an empty og:image resolves to the page itself: not an image
  if (image && (image === abs('', base) || image === abs('', baseUrl) || /\/$/.test(new URL(image).pathname))) image = undefined
  const ld = readJsonLd(html)
  if (!image && ld?.image) image = abs(ld.image, base)
  let authors = (multi.citation_author.length ? multi.citation_author : multi['article:author']).map((a) => clean(a, 80)).filter(Boolean)
  if (!authors.length && ld?.authors?.length) authors = ld.authors.map((a) => clean(a, 80)).filter(Boolean)
  const oembed = head.match(/<link\b[^>]*type=["']?(?:application|text)\/(?:json|xml)\+oembed["']?[^>]*>/i)
  const refresh = meta['refresh'] || head.match(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*>/i)?.[0]
  const refreshUrl = refresh ? (attrs(refresh.startsWith('<') ? refresh : `<m content="${refresh}">`).content || '').match(/url\s*=\s*['"]?([^'";]+)/i)?.[1] : undefined
  let title = clean(pick('og:title', 'twitter:title', 'citation_title', 'dc.title') || titleTag || ld?.title, 180)?.replace(/^(home|homepage|home page|welcome)\s*[-|–—:·]\s*/i, '')
  let description = clean(pick('og:description', 'description', 'twitter:description', 'citation_abstract', 'dc.description') || ld?.description, 320)
  if (!title || !description) {
    const b = bodyText(html)
    title ||= b.h1
    description ||= b.para && clean(b.para, 320)
  }
  return {
    title,
    description,
    ld,
    oembed: oembed ? abs(attrs(oembed[0]).href || '', base) : undefined,
    refresh: refreshUrl ? abs(refreshUrl.trim(), base) : undefined,
    site: clean(pick('og:site_name', 'application-name', 'apple-mobile-web-app-title', 'citation_journal_title', 'citation_publisher'), 60),
    image: image ? image.replace(/^http:\/\//, 'https://') : undefined,
    imageAlt: clean(pick('og:image:alt', 'twitter:image:alt'), 160),
    color: /^#[0-9a-f]{3,8}$/i.test(meta['theme-color'] || '') ? meta['theme-color'] : undefined,
    type: (meta['og:type'] || '').toLowerCase() || undefined,
    published: pick('article:published_time', 'citation_publication_date', 'citation_date', 'dc.date', 'date') || ld?.published,
    authors: authors.length ? authors : meta.author ? [clean(meta.author, 80)] : [],
    doi: pick('citation_doi', 'dc.identifier')?.replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:)/i, '').match(/^10\.\d{4,9}\/\S+$/)?.[0],
    lang,
    icons,
    canonical: abs(head.match(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/i) ? attrs(head.match(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/i)[0]).href || '' : '', base),
  }
}

/** Order icon candidates from best to worst (big raster / svg first, /favicon.ico last). */
export function rankIcons(icons, pageUrl) {
  const size = (s) => Math.max(0, ...String(s || '').split(/\s+/).map((x) => parseInt(x, 10) || 0))
  const score = (i) => {
    if (i.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(i.href)) return 900
    const px = size(i.sizes) || (i.rel.includes('apple-touch-icon') ? 180 : 0)
    if (px) return px >= 32 && px <= 256 ? 500 + px : px > 256 ? 400 : 100 + px
    return i.rel.includes('apple') ? 650 : 300
  }
  const list = [...icons].sort((a, b) => score(b) - score(a)).map((i) => i.href)
  try {
    list.push(new URL('/favicon.ico', pageUrl).href)
  } catch {
    /* ignore */
  }
  return [...new Set(list)]
}

/** Sniff an image buffer. Returns the mime type, or null if it isn't an image we accept. */
export function sniffImage(buf) {
  if (!buf || buf.length < 4) return null
  const h = buf.subarray(0, 12)
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return 'image/png'
  if (h[0] === 0xff && h[1] === 0xd8) return 'image/jpeg'
  if (h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46) return 'image/gif'
  if (h[0] === 0 && h[1] === 0 && (h[2] === 1 || h[2] === 2) && h[3] === 0) return 'image/x-icon'
  if (h.toString('latin1', 0, 4) === 'RIFF' && h.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  const text = buf.subarray(0, 600).toString('utf8').trimStart().toLowerCase()
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return 'image/svg+xml'
  return null
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/webp': 'webp', 'image/svg+xml': 'svg' }

/** Download the first working icon (≤ 64 KB). Falls back to Google's favicon service. */
export async function fetchIcon(candidates, host) {
  const list = [...candidates]
  if (host) list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`)
  for (const href of list.slice(0, 6)) {
    try {
      const r = await safeGet(href, { accept: 'image/svg+xml,image/png,image/*;q=0.9,*/*;q=0.1', max: 65_536, timeout: 5000 })
      if (r.status !== 200 || r.body.length < 40 || r.body.length >= 65_536) continue
      const type = sniffImage(r.body)
      if (!type) continue
      return { type, ext: EXT[type], body: r.body, hash: createHash('sha1').update(r.body).digest('hex').slice(0, 12) }
    } catch {
      /* try the next one */
    }
  }
  return null
}

export const dataUri = (icon) => `data:${icon.type};base64,${icon.body.toString('base64')}`

/* ------------------------------------------------------------- enrichers */

const fmtCount = (n) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))
const GH_RESERVED = new Set(['about', 'apps', 'blog', 'collections', 'contact', 'customer-stories', 'enterprise', 'events', 'explore', 'features', 'join', 'login', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing', 'pulls', 'issues', 'search', 'security', 'settings', 'site', 'sponsors', 'team', 'topics', 'trending'])

async function githubApi(path) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const r = await safeGet(`https://api.github.com${path}`, { accept: 'application/vnd.github+json', headers, max: 200_000, timeout: 6000 })
  if (r.status !== 200) throw new Error(`GitHub API ${r.status}`)
  return JSON.parse(r.body.toString('utf8'))
}

/** GitHub repos and profiles: description, stars, language, followers. */
async function enrichGithub(u) {
  const parts = u.pathname.split('/').filter(Boolean)
  if (parts.length === 1 && !GH_RESERVED.has(parts[0].toLowerCase())) {
    const j = await githubApi(`/users/${encodeURIComponent(parts[0])}`)
    const chips = [`${fmtCount(j.public_repos ?? 0)} repos`, `${fmtCount(j.followers ?? 0)} followers`]
    if (j.location) chips.push(j.location)
    return { kind: 'profile', title: j.name ? `${j.name} (@${j.login})` : `@${j.login}`, description: clean(j.bio, 320), avatar: j.avatar_url ? `${j.avatar_url}${j.avatar_url.includes('?') ? '&' : '?'}s=160` : undefined, chips, site: 'GitHub' }
  }
  if (parts.length === 4 && (parts[2] === 'issues' || parts[2] === 'pull') && /^\d+$/.test(parts[3])) {
    const j = await githubApi(`/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/issues/${parts[3]}`)
    const pr = !!j.pull_request
    const state = pr && j.pull_request.merged_at ? 'Merged' : j.state === 'closed' ? (j.state_reason === 'not_planned' ? 'Closed · not planned' : 'Closed') : j.draft ? 'Draft' : 'Open'
    const body = String(j.body || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/^#{1,6} .*$/gm, ' ').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]+/g, ' ')
    return {
      kind: 'issue',
      title: `${clean(j.title, 180)} #${j.number}`,
      description: clean(body, 280),
      avatar: j.user?.avatar_url ? `${j.user.avatar_url}${j.user.avatar_url.includes('?') ? '&' : '?'}s=96` : undefined,
      chips: [`${pr ? 'PR' : 'Issue'} · ${state}`, j.user?.login && `@${j.user.login}`, j.comments ? `${fmtCount(j.comments)} comments` : undefined, `${parts[0]}/${parts[1]}`].filter(Boolean),
      site: 'GitHub',
    }
  }
  if (parts.length === 2 && !GH_RESERVED.has(parts[0].toLowerCase())) {
    const j = await githubApi(`/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`)
    const chips = [`★ ${fmtCount(j.stargazers_count ?? 0)}`]
    if (j.language) chips.push(j.language)
    if (j.license?.spdx_id && j.license.spdx_id !== 'NOASSERTION') chips.push(j.license.spdx_id)
    if (j.forks_count) chips.push(`${fmtCount(j.forks_count)} forks`)
    return { kind: 'repo', title: j.full_name, description: clean(j.description, 320), avatar: j.owner?.avatar_url ? `${j.owner.avatar_url}${j.owner.avatar_url.includes('?') ? '&' : '?'}s=96` : undefined, chips, site: 'GitHub' }
  }
  return null
}

const CSL_TYPES = {
  'article-journal': 'Journal article', 'journal-article': 'Journal article',
  'paper-conference': 'Conference paper', 'proceedings-article': 'Conference paper',
  'posted-content': 'Preprint', article: 'Article', book: 'Book', chapter: 'Book chapter', 'book-chapter': 'Book chapter',
  report: 'Report', dataset: 'Dataset', 'blog-post': 'Blog post', thesis: 'Thesis', dissertation: 'Thesis', monograph: 'Book',
}

/** "Lewis et al." / "Robertson & Zaragoza" from a list of family names. */
const authorLine = (names) => (names.length > 2 ? `${names[0]} et al.` : names.join(' & ')) || undefined
const first = (v) => (Array.isArray(v) ? v[0] : v)

/** Well-known venues, found in arXiv comments ("Accepted at NeurIPS 2020"). */
const VENUE_RE = /\b(NeurIPS|NIPS|ICLR|ICML|ACL|EMNLP|NAACL|EACL|TACL|COLING|AAAI|IJCAI|CVPR|ICCV|ECCV|SIGIR|KDD|WSDM|CIKM|WWW|CHI|UIST|COLM|TMLR|JMLR)\b(?:[\s'’]*(\d{4}|'?\d{2}))?/

/** DOIs: doi.org content negotiation (Crossref, DataCite, mEDRA…), then the Crossref REST API. */
async function enrichDoi(u) {
  const doi = decodeURIComponent(u.pathname.slice(1))
  if (!/^10\.\d{4,9}\//.test(doi)) return null
  const arxiv = doi.match(/^10\.48550\/arxiv\.(.+)$/i)
  if (arxiv) {
    const r = await enrichArxiv(arxiv[1]).catch(() => null)
    if (r) return { ...r, chips: [...r.chips.filter((c) => !c.startsWith('arXiv ')).slice(0, 3), `DOI ${doi}`] }
  }
  let j
  try {
    const r = await safeGet(`https://doi.org/${doi}`, { accept: 'application/vnd.citationstyles.csl+json', max: 600_000, timeout: 7000 })
    if (r.status !== 200) throw new Error(`doi.org ${r.status}`)
    j = JSON.parse(r.body.toString('utf8'))
  } catch {
    const r = await safeGet(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { accept: 'application/json', max: 900_000, timeout: 8000, headers: { 'User-Agent': `${UA} mailto:iigulzaib@gmail.com` } })
    if (r.status !== 200) throw new Error(`crossref ${r.status}`)
    j = JSON.parse(r.body.toString('utf8')).message
  }
  const authors = (j.author || []).map((a) => a.family || a.literal || a.name).filter(Boolean)
  const parts = j.issued?.['date-parts']?.[0] || j.published?.['date-parts']?.[0] || j['published-print']?.['date-parts']?.[0] || []
  const year = parts[0]
  // Crossref REST: event.acronym; CSL-JSON: event / event-title is a string like "SIGIR '09: The 32nd …"
  const eventName = typeof j.event === 'object' ? j.event?.acronym || j.event?.name : j['event-title'] || j.event
  const event = eventName && String(eventName).split(/:\s/)[0].length <= 30 ? String(eventName).split(/:\s/)[0] : undefined
  const container = clean(first(j['container-title']), 80)
  const venue = clean(event, 30) || clean(first(j['container-title-short']) || first(j['short-container-title']), 40) || container || clean(j.publisher, 60)
  const abstract = clean(String(j.abstract || '').replace(/<jats:title>[^<]*<\/jats:title>/gi, ' '), 320)?.replace(/^Abstract\s+/i, '')
  // the publisher's own favicon (ACM, MIT Press…) reads better than the generic DOI mark
  const landing = j.resource?.primary?.URL || (j.link || []).map((l) => l.URL).find(Boolean)
  let pub
  try {
    pub = landing ? new URL(landing).origin : undefined
  } catch {
    pub = undefined
  }
  const who = authorLine(authors)
  return {
    kind: 'paper',
    title: clean(first(j.title), 200),
    description: abstract || [authors.slice(0, 8).join(', ') + (authors.length > 8 ? ' et al.' : ''), container].filter(Boolean).join(' · ') || undefined,
    site: (container && container.length <= 64 ? container : clean(j.publisher, 60)) || container || 'DOI',
    chips: [who, venue !== container && venue ? venue : CSL_TYPES[j.type], year && !String(venue).includes(String(year)) ? String(year) : undefined, `DOI ${doi}`].filter(Boolean).slice(0, 4),
    icons: [pub && `${pub}/favicon.ico`, 'https://www.doi.org/images/favicons/favicon-32x32.png', 'https://doi.org/favicon.ico'].filter(Boolean),
    iconHost: pub ? new URL(pub).hostname : 'doi.org',
  }
}

const ARXIV_ID = /^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(v\d+)?$/i
const xmlText = (s, tag) => s.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))?.[1]

/** arXiv papers via the official API (arxiv.org itself turns many bots away). */
async function enrichArxiv(id) {
  id = String(id).replace(/\.pdf$/i, '')
  if (!ARXIV_ID.test(id)) return null
  const bare = id.replace(/v\d+$/, '')
  const r = await safeGet(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`, { accept: 'application/atom+xml', max: 300_000, timeout: 9000 })
  if (r.status !== 200) throw new Error(`arXiv API ${r.status}`)
  const xml = r.body.toString('utf8')
  const entry = xmlText(xml, 'entry')
  const title = entry && clean(xmlText(entry, 'title'), 200)
  if (!title || /^error$/i.test(title)) return null
  const authors = [...entry.matchAll(/<author\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/gi)].map((m) => clean(m[1], 80)).filter(Boolean)
  const year = (xmlText(entry, 'published') || '').slice(0, 4)
  const note = clean(xmlText(entry, 'arxiv:journal_ref'), 120) || clean(xmlText(entry, 'arxiv:comment'), 400) || ''
  const v = note.match(VENUE_RE)
  const venue = v ? `${v[1] === 'NIPS' ? 'NeurIPS' : v[1]}${v[2] ? ` ${v[2].length === 2 || v[2].startsWith("'") ? `'${v[2].replace("'", '')}` : v[2]}` : ''}` : undefined
  const category = entry.match(/<arxiv:primary_category\b[^>]*term="([^"]+)"/i)?.[1]
  return {
    kind: 'paper',
    title,
    description: clean(xmlText(entry, 'summary'), 320),
    site: 'arXiv',
    chips: [authorLine(authors.map((a) => a.split(' ').pop())), venue || category, venue?.includes(year) ? undefined : year, `arXiv ${bare}`].filter(Boolean),
    icons: ['https://arxiv.org/static/browse/0.3.4/images/icons/favicon-32x32.png', 'https://arxiv.org/favicon.ico'],
    iconHost: 'arxiv.org',
  }
}

/** oEmbed endpoints for sites whose pages are heavy, client-rendered or bot-shy. */
const OEMBED = [
  [/^(m\.|music\.)?youtube\.com$|^youtu\.be$|^youtube-nocookie\.com$/, 'https://www.youtube.com/oembed', 'video'],
  [/^vimeo\.com$|^player\.vimeo\.com$/, 'https://vimeo.com/api/oembed.json', 'video'],
  [/^(twitter|x)\.com$|^mobile\.(twitter|x)\.com$/, 'https://publish.twitter.com/oembed', 'social'],
  [/^open\.spotify\.com$/, 'https://open.spotify.com/oembed', 'audio'],
  [/^soundcloud\.com$/, 'https://soundcloud.com/oembed', 'audio'],
  [/^tiktok\.com$/, 'https://www.tiktok.com/oembed', 'video'],
  [/^dailymotion\.com$|^dai\.ly$/, 'https://www.dailymotion.com/services/oembed', 'video'],
  [/^codepen\.io$/, 'https://codepen.io/api/oembed', 'web'],
  [/^flickr\.com$|^flic\.kr$/, 'https://www.flickr.com/services/oembed/', 'image'],
  [/^reddit\.com$|^old\.reddit\.com$/, 'https://www.reddit.com/oembed', 'social'],
  [/^loom\.com$/, 'https://www.loom.com/v1/oembed', 'video'],
  [/^figma\.com$/, 'https://www.figma.com/api/oembed', 'web'],
]
const PROVIDER_ICON = { youtube: 'https://www.youtube.com/s/desktop/favicon_144x144.png', 'youtu.be': 'https://www.youtube.com/s/desktop/favicon_144x144.png' }

/** oEmbed (a known provider, or one the page advertises). */
async function enrichOembed(endpoint, url, kindHint) {
  const href = endpoint.includes('?') && /[?&]url=/.test(endpoint) ? endpoint : `${endpoint}${endpoint.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}&format=json&maxwidth=640`
  const r = await safeGet(href, { accept: 'application/json', max: 200_000, timeout: 6000 })
  if (r.status !== 200) throw new Error(`oEmbed ${r.status}`)
  const j = JSON.parse(decodeBody(r.body, r.type))
  const kind = j.type === 'video' ? 'video' : j.type === 'photo' ? 'image' : kindHint || 'web'
  // tweets and posts come as HTML: the text is the description
  const text = j.html && kind === 'social' ? clean(String(j.html).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1], 320) : undefined
  const author = clean(j.author_name, 60)
  const title = kind === 'social' ? (author ? `${author} on ${j.provider_name || 'X'}` : clean(j.title, 180)) : clean(j.title, 180)
  return {
    kind,
    title: title || author,
    description: text || (kind !== 'social' && author ? `by ${author}` : undefined),
    site: clean(j.provider_name, 40),
    image: (j.type === 'photo' && j.url) || j.thumbnail_url || undefined,
    chips: [kind !== 'social' && author, j.duration && fmtDuration(`PT${Math.round(j.duration)}S`)].filter(Boolean),
  }
}

/** Wikipedia: the REST summary (title, short description, first paragraph, lead image). */
async function enrichWikipedia(u) {
  const lang = u.hostname.split('.')[0]
  const title = u.pathname.match(/^\/wiki\/(.+)$/)?.[1]
  if (!title || /^(Special|File|Talk|User|Wikipedia|Help|Template|Category|Portal):/i.test(decodeURIComponent(title))) return null
  const r = await safeGet(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`, { accept: 'application/json', max: 200_000, timeout: 6000 })
  if (r.status !== 200) throw new Error(`Wikipedia ${r.status}`)
  const j = JSON.parse(r.body.toString('utf8'))
  return {
    kind: 'article',
    title: clean(j.title, 180),
    description: clean(j.extract, 320),
    site: 'Wikipedia',
    image: j.thumbnail?.source || j.originalimage?.source,
    chips: [clean(j.description, 60), lang !== 'en' && lang.toUpperCase()].filter(Boolean),
    icons: ['https://en.wikipedia.org/static/apple-touch/wikipedia.png', 'https://en.wikipedia.org/static/favicon/wikipedia.ico'],
    iconHost: 'wikipedia.org',
  }
}

/** npm packages: the registry, plus weekly downloads. */
async function enrichNpm(name) {
  // /latest is one small version document (the full packument can be many MB)
  const r = await safeGet(`https://registry.npmjs.org/${name.replace('/', '%2f')}/latest`, { accept: 'application/json', max: 600_000, timeout: 6000 })
  if (r.status !== 200) throw new Error(`npm ${r.status}`)
  const v = JSON.parse(r.body.toString('utf8'))
  const latest = v.version
  const j = { name: v.name }
  let weekly
  try {
    const d = await safeGet(`https://api.npmjs.org/downloads/point/last-week/${name}`, { accept: 'application/json', max: 10_000, timeout: 3000 })
    if (d.status === 200) weekly = JSON.parse(d.body.toString('utf8')).downloads
  } catch {
    /* optional */
  }
  return {
    kind: 'package',
    title: j.name,
    description: clean(v.description || j.description, 320),
    site: 'npm',
    chips: [latest && `v${latest}`, clean(typeof v.license === 'string' ? v.license : v.license?.type, 20), weekly ? `${fmtCount(weekly)}/week` : undefined, v.engines?.node && `Node ${v.engines.node}`].filter(Boolean),
    icons: ['https://www.npmjs.com/favicon.ico'],
    iconHost: 'npmjs.com',
  }
}

/** PyPI projects. */
async function enrichPypi(name) {
  const r = await safeGet(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, { accept: 'application/json', max: 3_000_000, timeout: 6000 })
  if (r.status !== 200) throw new Error(`PyPI ${r.status}`)
  const i = JSON.parse(r.body.toString('utf8')).info || {}
  const license = clean(i.license_expression || (i.license && i.license.length < 30 ? i.license : '') || (i.classifiers || []).find((c) => c.startsWith('License ::'))?.split('::').pop(), 24)
  return {
    kind: 'package',
    title: i.name,
    description: clean(i.summary, 320),
    site: 'PyPI',
    chips: [i.version && `v${i.version}`, license, i.requires_python && `Python ${i.requires_python}`].filter(Boolean),
    icons: ['https://pypi.org/static/images/favicon.35549fe8.ico', 'https://pypi.org/favicon.ico'],
    iconHost: 'pypi.org',
  }
}

const EXT_KIND = {
  pdf: 'file', zip: 'file', gz: 'file', tgz: 'file', rar: 'file', '7z': 'file', dmg: 'file', exe: 'file', apk: 'file', msi: 'file', csv: 'file', json: 'file', txt: 'file', md: 'file',
  docx: 'file', doc: 'file', xlsx: 'file', xls: 'file', pptx: 'file', ppt: 'file', epub: 'file', ipynb: 'file',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', svg: 'image',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio',
}
const MIME_EXT = { 'application/pdf': 'pdf', 'application/zip': 'zip', 'application/gzip': 'gz', 'application/json': 'json', 'text/csv': 'csv', 'text/plain': 'txt', 'text/markdown': 'md', 'application/epub+zip': 'epub' }

/** Cards for anything that isn't a web page: images, video, audio, PDFs, archives, text. */
function fileCard(u, r) {
  const type = r.type.split(';')[0].trim()
  // Content-Disposition names the download (codeload, S3, …) better than the path does
  const cd = String(r.headers?.['content-disposition'] || '')
  const fromHeader = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1] || cd.match(/filename="?([^";]+)"?/i)?.[1]
  let name = u.pathname.split('/').pop() || u.hostname
  try {
    name = decodeURIComponent(fromHeader?.trim() || name)
  } catch {
    /* keep it raw */
  }
  const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || MIME_EXT[type] || type.split('/')[1] || 'file').toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const kind = type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'file'
  const size = fmtBytes(r.length)
  const dims = kind === 'image' ? imageSize(r.body) : null
  const text = type.startsWith('text/') || type === 'application/json' ? clean(decodeBody(r.body, r.type).slice(0, 2000), 240) : undefined
  return {
    kind,
    title: name,
    description: text,
    site: `${ext.toUpperCase()} ${kind === 'file' ? 'file' : kind}`,
    image: kind === 'image' && u.protocol === 'https:' && (!r.length || r.length < 8e6) ? u.href : undefined,
    file: ext,
    chips: [ext.toUpperCase(), dims && dims.w && `${dims.w} × ${dims.h}`, size].filter(Boolean),
  }
}

/* ------------------------------------------------------------- top level */

const hostOf = (u) => u.hostname.replace(/^www\./, '')

/**
 * Fetch everything needed for one preview card. Never throws: failures come
 * back as { ok: false, error }.
 * `icon` is { type, ext, body, hash } (callers decide whether to inline or save it).
 */
export async function fetchPreview(url) {
  let u
  try {
    u = checkUrl(url)
  } catch (e) {
    return { ok: false, error: e.code || e.message }
  }
  u.hash = ''
  const host = hostOf(u)
  // 1. structured sources first (APIs beat scraping)
  let extra = null
  try {
    if (host === 'github.com') extra = await enrichGithub(u)
    else if (host === 'doi.org' || host === 'dx.doi.org') extra = await enrichDoi(u)
    else if (host === 'arxiv.org' || host === 'export.arxiv.org') {
      const m = u.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)\/?$/)
      if (m) extra = await enrichArxiv(m[1])
    } else if (/(^|\.)wikipedia\.org$/.test(host)) extra = await enrichWikipedia(u)
    else if (host === 'npmjs.com' && u.pathname.startsWith('/package/')) extra = await enrichNpm(decodeURIComponent(u.pathname.slice(9)).replace(/\/v\/.*$/, '').replace(/\/$/, ''))
    else if (host === 'pypi.org' && u.pathname.startsWith('/project/')) extra = await enrichPypi(u.pathname.split('/')[2])
    else {
      const o = OEMBED.find(([re]) => re.test(host))
      if (o) extra = await enrichOembed(o[1], u.href, o[2])
    }
  } catch {
    extra = null
  }
  // 2. the page itself (files get a file card)
  let page = null
  let file = null
  let finalUrl = u.href
  let error
  if (!extra || !extra.title || (host === 'github.com' && extra.kind !== 'issue')) {
    const get = async (target, ua) => {
      const r = await safeGet(target, { timeout: ua ? 5000 : 6500, headers: ua ? { 'User-Agent': ua } : {} })
      return r
    }
    let r = null
    try {
      r = await get(u.href)
    } catch (e) {
      error = e.code || e.message
    }
    // bot walls, rate limits and flaky servers: one more try, looking like a browser
    if ((!r && /ECONNRESET|ETIMEDOUT|EPROTO|socket hang up/i.test(String(error))) || (r && [403, 406, 429, 503, 520, 522].includes(r.status))) {
      try {
        r = await get(u.href, BROWSER_UA)
        error = undefined
      } catch (e) {
        error ||= e.code || e.message
      }
    }
    if (r) {
      finalUrl = r.url
      if (r.status >= 400) error = `HTTP ${r.status}`
      else if (!r.type || /html|xhtml/.test(r.type) || (/xml/.test(r.type) && !/rss|atom/.test(r.type) && r.body.subarray(0, 600).toString('latin1').includes('<html'))) {
        page = parseHtml(decodeBody(r.body, r.type), r.url)
        // <meta http-equiv="refresh"> pages (link shorteners, moved pages)
        if (page.refresh && page.refresh !== r.url && (!page.title || page.title.length < 4)) {
          try {
            const r2 = await safeGet(page.refresh, { timeout: 5000 })
            if (r2.status < 400 && /html/.test(r2.type)) {
              finalUrl = r2.url
              page = parseHtml(decodeBody(r2.body, r2.type), r2.url)
            }
          } catch {
            /* keep the first page */
          }
        }
        // pages that advertise oEmbed but lack the basics
        if (page.oembed && !extra && (!page.image || !page.title)) {
          try {
            const o = await enrichOembed(page.oembed, finalUrl)
            extra = { ...o, title: page.title || o.title, description: page.description || o.description }
          } catch {
            /* optional */
          }
        }
      } else if (/rss|atom/.test(r.type) || (/xml/.test(r.type) && /<(rss|feed)\b/.test(r.body.subarray(0, 2000).toString('latin1')))) {
        const xml = decodeBody(r.body, r.type)
        const items = (xml.match(/<(item|entry)\b/gi) || []).length
        file = { kind: 'feed', title: clean(xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, ''), 180) || host, description: clean((xml.match(/<(description|subtitle)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || '').replace(/<!\[CDATA\[|\]\]>/g, ''), 240), site: /atom/.test(r.type) || /<feed\b/.test(xml) ? 'Atom feed' : 'RSS feed', file: 'xml', chips: [items ? `${items}+ items` : undefined].filter(Boolean) }
      } else file = fileCard(new URL(r.url), r)
    }
  }
  const finalHost = hostOf(new URL(finalUrl))
  const icon = extra?.icons?.length
    ? await fetchIcon(extra.icons, extra.iconHost)
    : await fetchIcon(page?.icons?.length ? rankIcons(page.icons, finalUrl) : [PROVIDER_ICON[finalHost.split('.')[0]] || PROVIDER_ICON[finalHost], new URL('/favicon.ico', finalUrl).href].filter(Boolean), finalHost)
  if (file) return { ok: true, finalUrl, ...file, icon }
  const ld = page?.ld
  const title = extra?.title || page?.title
  if (!title && !extra) return { ok: false, error: error || 'no metadata', icon, finalUrl }
  const chips = [...(extra?.chips || page?.chips || [])]
  if (!extra && ld) for (const c of [ld.price, ld.rating, ld.duration, ld.place]) if (c) chips.push(c)
  if (!extra && page?.published) {
    const d = new Date(page.published)
    if (!Number.isNaN(+d)) chips.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
  }
  // (an "author" that is just the site itself says nothing)
  const people = (page?.authors || []).filter((a) => a.toLowerCase() !== String(page?.site || '').toLowerCase() && !String(page?.title || '').toLowerCase().endsWith(a.toLowerCase()))
  if (!extra && people.length) chips.unshift(people.length > 2 ? `${people[0]} et al.` : people.join(' & '))
  const kind = extra?.kind || page?.kind || (page?.authors?.length && page?.doi ? 'paper' : ld?.kind && ld.kind !== 'event' ? ld.kind : page?.type?.startsWith('video') ? 'video' : page?.type === 'article' ? 'article' : page?.type === 'profile' ? 'profile' : 'web')
  return {
    ok: true,
    finalUrl,
    kind,
    title,
    description: extra?.description || page?.description,
    site: extra?.site || page?.site,
    image: extra?.kind === 'profile' ? undefined : extra?.image || page?.image,
    imageAlt: page?.imageAlt,
    avatar: extra?.avatar,
    color: page?.color,
    chips: [...new Set(chips)].slice(0, 4),
    icon,
  }
}

/* ------------------------------------------------- shared entry + routing */

/** Hosts that are this site (links to them are previewed from local data). */
export const SITE_HOSTS = ['gulzaib.vercel.app', 'localhost']

/** Share intents, API endpoints and other links that should never get a card. */
export const SKIP_URL = /^https?:\/\/([^/]+\.)?(schema\.org|w3\.org|ogp\.me|example\.(com|org)|x\.invalid|fonts\.(googleapis|gstatic)\.com|openapi\.vercel\.sh)(\/|$)|supabase\.co|api\.indexnow\.org|rogue-scholar\.org\/api|api\.github\.com|google\.com\/s2\/|linkedin\.com\/sharing|x\.com\/intent|twitter\.com\/intent|facebook\.com\/sharer|wa\.me\/?\?|api\.whatsapp\.com\/send\?text/i

/** Stable lookup key for a link: path for this site, host + path + query for others (no www, hash or utm_*). */
export function previewKey(href, base = 'https://gulzaib.vercel.app/') {
  let u
  try {
    u = new URL(href, base)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|ref)$/i.test(k)) u.searchParams.delete(k)
  const path = u.pathname.replace(/\/+$/, '') || '/'
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (SITE_HOSTS.includes(host) || u.host === new URL(base).host) return path + u.search
  return `${host}${path === '/' ? '' : path}${u.search}`
}

/** Compact JSON entry for the browser. `icon` is a URL or data: URI. */
export function toEntry(r, icon) {
  if (!r.ok) return { ok: 0, ...(icon ? { i: icon } : {}) }
  const e = { ok: 1, k: r.kind, t: r.title }
  if (r.description) e.d = r.description
  if (r.site) e.s = r.site
  if (icon) e.i = icon
  if (r.image) e.img = r.image
  if (r.imageAlt) e.alt = r.imageAlt
  if (r.avatar) e.av = r.avatar
  if (r.color) e.c = r.color
  if (r.chips?.length) e.m = r.chips
  if (r.file) e.f = r.file
  return e
}

/** Canonical form used for caching: no hash, no tracking parameters, sorted query. */
export function normalizeUrl(input) {
  const u = new URL(input)
  u.hash = ''
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|mc_eid|mc_cid|igshid|ref_src|si)$/i.test(k)) u.searchParams.delete(k)
  u.searchParams.sort()
  return u.href
}

/* Per-instance memory: a small LRU of answers, in-flight requests shared, and a rate limit. */
const MEM_MAX = 400
const MEM_OK_MS = 6 * 3600e3
const MEM_FAIL_MS = 10 * 60e3
const memory = new Map()
const inflight = new Map()
const buckets = new Map()
const RATE = { burst: 30, perSec: 0.5 } // 30 at once, then one every 2 s

function remember(key, entry) {
  memory.delete(key)
  memory.set(key, { at: Date.now(), entry })
  while (memory.size > MEM_MAX) memory.delete(memory.keys().next().value)
}
function recall(key) {
  const hit = memory.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > (hit.entry.ok ? MEM_OK_MS : MEM_FAIL_MS)) {
    memory.delete(key)
    return null
  }
  memory.delete(key)
  memory.set(key, hit) // most recently used
  return hit
}
function allow(ip) {
  const now = Date.now()
  const b = buckets.get(ip) || { tokens: RATE.burst, at: now }
  b.tokens = Math.min(RATE.burst, b.tokens + ((now - b.at) / 1000) * RATE.perSec)
  b.at = now
  buckets.set(ip, b)
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value)
  if (b.tokens < 1) return Math.ceil((1 - b.tokens) / RATE.perSec)
  b.tokens -= 1
  return 0
}

/** Preview entry for one URL, from memory or the network (concurrent callers share one fetch). */
export async function previewEntry(target) {
  const key = normalizeUrl(target)
  const hit = recall(key)
  if (hit) return { entry: hit.entry, cache: 'HIT', at: hit.at }
  let p = inflight.get(key)
  const shared = !!p
  if (!p) {
    p = fetchPreview(key)
      .then((r) => {
        const entry = toEntry(r, r.icon ? dataUri(r.icon) : undefined)
        remember(key, entry)
        return entry
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return { entry: await p, cache: shared ? 'SHARED' : 'MISS', at: Date.now() }
}

/**
 * Runtime fallback (Vercel function + dev server): GET /api/link-preview?url=…
 * Only used for links the build couldn't preview. Same-origin callers only.
 * Caching, outermost first: the browser (localStorage, see src/lib/linkPreview/data.ts),
 * Vercel's edge (s-maxage + stale-while-revalidate), this instance's LRU, and ETags.
 */
export async function previewHandler(req, res) {
  const send = (status, body, cache, extra = {}) => {
    const json = JSON.stringify(body)
    const etag = `W/"${createHash('sha1').update(json).digest('base64url').slice(0, 16)}"`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', cache)
    res.setHeader('ETag', etag)
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v)
    if (status === 200 && String(req.headers['if-none-match'] || '') === etag) {
      res.statusCode = 304
      return res.end()
    }
    res.statusCode = status
    res.end(json)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { ok: 0, error: 'method' }, 'no-store', { Allow: 'GET, HEAD' })
  const site = String(req.headers['sec-fetch-site'] || '')
  if (site && site !== 'same-origin' && site !== 'none') return send(403, { ok: 0, error: 'cross-site' }, 'no-store')
  const target = new URL(req.url || '/', 'http://x').searchParams.get('url') || ''
  if (!target || target.length > 2048 || SKIP_URL.test(target)) return send(400, { ok: 0, error: 'not previewable' }, 'public, max-age=86400')
  try {
    checkUrl(target)
  } catch (e) {
    return send(400, { ok: 0, error: e.code || 'invalid url' }, 'public, max-age=86400')
  }
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
  const wait = allow(ip)
  if (wait) return send(429, { ok: 0, error: 'slow down' }, 'no-store', { 'Retry-After': String(wait) })
  const { entry, cache } = await previewEntry(target)
  // good answers: a day in the browser, a week at the edge (served stale for a month while refreshing);
  // failures: briefly, so a site that was down gets another chance soon
  send(200, entry, entry.ok ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000' : 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600', { 'X-Preview-Cache': cache })
}
