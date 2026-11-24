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

export const UA = 'Mozilla/5.0 (compatible; GulLinkPreview/1.0; +https://gulzaib.vercel.app/blog)'

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
export function safeGet(input, { accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', max = 400_000, timeout = 7000, redirects = 5, headers = {} } = {}) {
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
            resolve({ url: u.href, status, type: String(res.headers['content-type'] || '').toLowerCase(), body: Buffer.concat(chunks) })
          }
          stream.on('data', (c) => {
            size += c.length
            chunks.push(c)
            if (size >= max) {
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
  const t = decode(String(s)).replace(/<[^>]+>/g, ' ').replace(/[\u2b50\u2b51\u2729-\u2730]\ufe0f?/g, '★').replace(/\s+/g, ' ').trim()
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
  const image = abs(pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src') || '', base)
  const authors = (multi.citation_author.length ? multi.citation_author : multi['article:author']).map((a) => clean(a, 80)).filter(Boolean)
  return {
    title: clean(pick('og:title', 'twitter:title', 'citation_title', 'dc.title') || titleTag, 180),
    description: clean(pick('og:description', 'description', 'twitter:description', 'citation_abstract', 'dc.description'), 320),
    site: clean(pick('og:site_name', 'application-name', 'apple-mobile-web-app-title', 'citation_journal_title', 'citation_publisher'), 60),
    image: image && image.startsWith('https:') ? image : undefined,
    imageAlt: clean(pick('og:image:alt', 'twitter:image:alt'), 160),
    color: /^#[0-9a-f]{3,8}$/i.test(meta['theme-color'] || '') ? meta['theme-color'] : undefined,
    type: (meta['og:type'] || '').toLowerCase() || undefined,
    published: pick('article:published_time', 'citation_publication_date', 'citation_date', 'dc.date', 'date'),
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
  const event = typeof j.event === 'object' ? j.event?.acronym : undefined
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
    description: abstract || [authors.slice(0, 6).join(', '), container, year].filter(Boolean).join(' · ') || undefined,
    site: (container && container.length <= 64 ? container : clean(j.publisher, 60)) || container || 'DOI',
    chips: [who, venue !== container && venue ? venue : CSL_TYPES[j.type], year && String(year), `DOI ${doi}`].filter(Boolean).slice(0, 4),
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
  const host = hostOf(u)
  let extra = null
  try {
    if (host === 'github.com') extra = await enrichGithub(u)
    else if (host === 'doi.org' || host === 'dx.doi.org') extra = await enrichDoi(u)
    else if (host === 'arxiv.org' || host === 'export.arxiv.org') {
      const m = u.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)\/?$/)
      if (m) extra = await enrichArxiv(m[1])
    }
  } catch {
    extra = null
  }
  let page = null
  let finalUrl = u.href
  let error
  if (!extra || !extra.title || host === 'github.com') {
    try {
      const r = await safeGet(u.href)
      finalUrl = r.url
      if (r.status >= 400) error = `HTTP ${r.status}`
      else if (r.type.includes('html') || r.type.includes('xml') || !r.type) page = parseHtml(r.body.toString('utf8'), r.url)
      else if (r.type.includes('pdf')) page = { title: decodeURIComponent(u.pathname.split('/').pop() || host), kind: 'file', chips: ['PDF'], icons: [] }
    } catch (e) {
      error = e.code || e.message
    }
  }
  const icon = extra?.icons?.length
    ? await fetchIcon(extra.icons, extra.iconHost)
    : await fetchIcon(page?.icons?.length ? rankIcons(page.icons, finalUrl) : [new URL('/favicon.ico', finalUrl).href], hostOf(new URL(finalUrl)))
  const title = extra?.title || page?.title
  if (!title && !extra) return { ok: false, error: error || 'no metadata', icon, finalUrl }
  const chips = [...(extra?.chips || page?.chips || [])]
  if (!extra && page?.published) {
    const d = new Date(page.published)
    if (!Number.isNaN(+d)) chips.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
  }
  if (!extra && page?.authors?.length) chips.unshift(page.authors.length > 2 ? `${page.authors[0]} et al.` : page.authors.join(' & '))
  return {
    ok: true,
    finalUrl,
    kind: extra?.kind || page?.kind || (page?.authors?.length && page?.doi ? 'paper' : page?.type === 'article' ? 'article' : 'web'),
    title,
    description: extra?.description || page?.description,
    site: extra?.site || page?.site,
    image: extra?.kind === 'profile' ? undefined : page?.image,
    imageAlt: page?.imageAlt,
    avatar: extra?.avatar,
    color: page?.color,
    chips: chips.slice(0, 4),
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
  return e
}

/**
 * Runtime fallback (Vercel function + dev server): GET /api/link-preview?url=…
 * Only used for links the build couldn't preview. Same-origin callers only.
 */
export async function previewHandler(req, res) {
  const send = (status, body, cache) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', cache)
    res.end(JSON.stringify(body))
  }
  if (req.method !== 'GET') return send(405, { ok: 0, error: 'method' }, 'no-store')
  const site = String(req.headers['sec-fetch-site'] || '')
  if (site && site !== 'same-origin' && site !== 'none') return send(403, { ok: 0, error: 'cross-site' }, 'no-store')
  const target = new URL(req.url || '/', 'http://x').searchParams.get('url') || ''
  if (target.length > 2048 || SKIP_URL.test(target)) return send(400, { ok: 0, error: 'not previewable' }, 'public, max-age=86400')
  const r = await fetchPreview(target)
  const entry = toEntry(r, r.icon ? dataUri(r.icon) : undefined)
  // cache good answers for a week at the edge, failures briefly
  send(200, entry, entry.ok ? 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000' : 'public, max-age=300, s-maxage=3600')
}
