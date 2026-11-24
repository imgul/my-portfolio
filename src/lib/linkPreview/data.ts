/**
 * Link preview data for any link. Sources, best first:
 *  1. built in: email, phone and WhatsApp links, in-page sections and
 *     citations, blog topics and saved posts
 *  2. /link-previews.json, written at build time (scripts/link-previews.mjs):
 *     every link on the site, with favicons saved locally
 *  3. this browser's cache (localStorage, stale-while-revalidate)
 *  4. /api/link-preview?url=… (live fetch for links the build missed),
 *     through a small priority queue with retries; visible links are
 *     prefetched lazily when the browser is idle (not on Save-Data / 2G)
 *  5. a card built from the URL alone (brand name, colour, monogram)
 */
import { BRANDS } from './brands'

export type Kind =
  | 'web' | 'article' | 'post' | 'page' | 'file' | 'feed' | 'repo' | 'profile' | 'paper' | 'email' | 'phone' | 'chat' | 'topic'
  | 'video' | 'audio' | 'image' | 'package' | 'issue' | 'product' | 'social' | 'event' | 'section' | 'cite'

/** Compact manifest entry (see toEntry in scripts/link-meta.mjs). */
interface Entry {
  ok: 0 | 1
  k?: Kind
  t?: string
  d?: string
  s?: string
  i?: string
  img?: string
  alt?: string
  av?: string
  c?: string
  m?: string[]
  f?: string
  cat?: string
}
interface PostLite {
  slug: string
  t: string
  cat: string
  c: string
  tags: string[]
  min: number
  date: string
}
interface Manifest {
  v: number
  site: string
  posts: PostLite[]
  e: Record<string, Entry>
}

export interface Preview {
  key: string
  href: string
  kind: Kind
  title: string
  description?: string
  site: string
  host: string
  /** host + path for the footer */
  display: string
  icon?: string
  image?: string
  imageAlt?: string
  avatar?: string
  color?: string
  chips: string[]
  file?: string
  external: boolean
  newTab: boolean
  action: string
  /** topic pages: a few posts */
  list?: { title: string; meta: string; color?: string }[]
  /** still fetching (shows a shimmer) */
  loading?: boolean
  /** couldn't load details: why (the card falls back to what the URL tells us) */
  failed?: 'offline' | 'error'
  /** footer hint override ("jumps to section") */
  hint?: string
}

const SITE_HOSTS = ['gulzaib.vercel.app']
const isBrowser = typeof window !== 'undefined'

/* -------------------------------------------------------------- manifest */

let manifest: Manifest | null = null
let manifestP: Promise<Manifest | null> | null = null

export function loadManifest(): Promise<Manifest | null> {
  if (manifest) return Promise.resolve(manifest)
  manifestP ??= fetch('/link-previews.json', { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m: Manifest | null) => (manifest = m && m.e ? m : null))
    .catch(() => null)
  return manifestP
}

/** Warm the manifest when the browser is idle, so the first hover is instant. */
export function prefetchManifest() {
  if (!isBrowser) return
  const go = () => void loadManifest()
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
    }
  ).requestIdleCallback
  if (ric) ric(go, { timeout: 4000 })
  else setTimeout(go, 2500)
}

/* ------------------------------------------------------------------- keys */

/** Mirrors previewKey() in scripts/link-meta.mjs. */
export function previewKey(u: URL): string {
  const url = new URL(u.href)
  for (const k of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|ref)$/i.test(k)) url.searchParams.delete(k)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (isOwn(url)) return path + url.search
  return `${host}${path === '/' ? '' : path}${url.search}`
}

const isOwn = (u: URL) => (isBrowser && u.host === location.host) || SITE_HOSTS.includes(u.hostname.replace(/^www\./, ''))

/* ---------------------------------------------------------------- helpers */

const hostOf = (u: URL) => u.hostname.replace(/^www\./, '')

function brandFor(host: string) {
  const parts = host.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    const b = BRANDS[parts.slice(i).join('.')]
    if (b) return b
  }
  return null
}

/** host + path, shortened in the middle (keeps the start and the file name). */
function displayOf(u: URL) {
  if (u.protocol === 'mailto:' || u.protocol === 'tel:') return safeDecode(u.pathname)
  let path = ''
  try {
    path = decodeURI(u.pathname + u.search)
  } catch {
    path = u.pathname + u.search
  }
  path = path.replace(/\/$/, '')
  const s = (isOwn(u) ? hostOf(new URL(u.href.replace(u.host, SITE_HOSTS[0]))) : hostOf(u)) + path
  return s.length > 56 ? `${s.slice(0, 34)}…${s.slice(-20)}` : s
}

const safeDecode = (v: string) => {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

const titleFromPath = (u: URL) => {
  const host = hostOf(u)
  const path = safeDecode(u.pathname)
  // well-known identifiers read better as-is
  if (host === 'doi.org' && path.length > 1) return `DOI ${path.slice(1)}`
  const arxiv = host === 'arxiv.org' && path.match(/^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?$/)
  if (arxiv) return `arXiv:${arxiv[1]}`
  const parts = path.split('/').filter(Boolean)
  const last = parts.pop() ?? ''
  if (!last) return host
  // …/issues/12, /pull/7, /posts/42: "Issue #12"
  if (/^\d+$/.test(last) && parts.length) {
    const what = parts[parts.length - 1].replace(/[-_]+/g, ' ').replace(/s$/i, '').replace(/^pull$/i, 'pull request')
    const repo = host === 'github.com' && parts.length >= 3 ? `${parts[0]}/${parts[1]} · ` : ''
    return `${repo}${what.replace(/^\w/, (c) => c.toUpperCase())} #${last}`
  }
  return last
    .replace(/\.(html?|php|aspx?|jsp|md|mdx|txt|pdf)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

function actionFor(kind: Kind, p: { external: boolean; site: string; host: string; file?: string }) {
  switch (kind) {
    case 'post':
      return 'Read post'
    case 'topic':
      return 'Show posts'
    case 'file':
      return p.file === 'pdf' ? 'Open PDF' : p.file === 'md' ? 'Open Markdown' : 'Open file'
    case 'feed':
      return 'Open feed'
    case 'repo':
      return 'Open on GitHub'
    case 'profile':
      return `Open ${p.site}`
    case 'paper':
      return 'Open paper'
    case 'video':
      return 'Watch video'
    case 'audio':
      return 'Listen'
    case 'image':
      return 'Open image'
    case 'package':
      return `View on ${p.site}`
    case 'issue':
      return 'Open on GitHub'
    case 'product':
      return 'View product'
    case 'social':
      return 'Open post'
    case 'event':
      return 'View event'
    case 'section':
      return 'Jump to section'
    case 'cite':
      return 'Jump to reference'
    case 'email':
      return 'Write email'
    case 'phone':
      return 'Call'
    case 'chat':
      return 'Open WhatsApp'
    default:
      return p.external ? `Visit ${p.host}` : 'Open page'
  }
}

function base(a: HTMLAnchorElement, u: URL): Pick<Preview, 'key' | 'href' | 'host' | 'display' | 'external' | 'newTab'> {
  return {
    key: previewKey(u),
    href: u.href,
    host: isOwn(u) ? SITE_HOSTS[0] : hostOf(u),
    display: displayOf(u),
    external: !isOwn(u),
    newTab: a.target === '_blank',
  }
}

function fromEntry(a: HTMLAnchorElement, u: URL, e: Entry): Preview {
  const b = base(a, u)
  const brand = brandFor(b.host)
  const kind: Kind = e.k ?? 'web'
  const site = e.s || brand?.name || b.host
  return {
    ...b,
    kind,
    title: e.t || titleFromPath(u),
    description: e.d,
    site,
    icon: e.i || (b.external ? undefined : '/favicon.svg'),
    image: e.img,
    imageAlt: e.alt,
    avatar: e.av,
    color: e.c || brand?.color,
    chips: e.m ?? [],
    file: e.f,
    action: actionFor(kind, { ...b, site, file: e.f }),
  }
}

/* --------------------------------------------------------------- built-in */

function formatPhone(n: string) {
  const d = n.replace(/[^\d]/g, '')
  if (d.startsWith('92') && d.length === 12) return `+92 ${d.slice(2, 5)} ${d.slice(5)}`
  if (d.length > 6) return `+${d.slice(0, d.length - 10 || 1)} ${d.slice(-10, -7)} ${d.slice(-7)}`.trim()
  return `+${d}`
}

function builtIn(a: HTMLAnchorElement, u: URL): Preview | null {
  const b = base(a, u)
  if (u.protocol === 'mailto:') {
    const to = safeDecode(u.pathname)
    const subject = u.searchParams.get('subject')
    return {
      ...b,
      kind: 'email',
      title: to,
      site: 'Email',
      description: to === 'iigulzaib@gmail.com' ? 'Write to Muhammad Gulzaib. He usually replies within a day.' : 'Opens your email app with a new message.',
      chips: subject ? [`Subject: ${subject}`] : ['Opens your mail app'],
      host: to.split('@')[1] ?? '',
      display: `mailto:${to}`,
      action: actionFor('email', { ...b, site: 'Email' }),
      external: true,
      newTab: false,
    }
  }
  if (u.protocol === 'tel:') {
    const num = safeDecode(u.pathname)
    return {
      ...b,
      kind: 'phone',
      title: formatPhone(num),
      site: 'Phone',
      description: 'Call this number from your phone.',
      chips: [],
      display: `tel:${num}`,
      host: '',
      action: 'Call',
      external: true,
      newTab: false,
    }
  }
  const host = hostOf(u)
  if (host === 'wa.me' || (host === 'api.whatsapp.com' && u.pathname === '/send')) {
    const num = host === 'wa.me' ? u.pathname.slice(1) : (u.searchParams.get('phone') ?? '')
    return {
      ...b,
      kind: 'chat',
      title: num ? formatPhone(num) : 'WhatsApp',
      site: 'WhatsApp',
      description: 'Start a WhatsApp chat. Opens the app on your phone, or WhatsApp Web on a computer.',
      chips: ['Chat', 'End-to-end encrypted'],
      color: '#25d366',
      action: 'Open WhatsApp',
    }
  }
  return null
}

/** /blog?tag=…, /blog?category=…, /blog?saved=1, /blog#topics */
function blogTopic(a: HTMLAnchorElement, u: URL, m: Manifest): Preview | null {
  if (!isOwn(u) || u.pathname.replace(/\/+$/, '') !== '/blog') return null
  const tag = u.searchParams.get('tag')
  const cat = u.searchParams.get('category')
  const b = base(a, u)
  const posts = m.posts
  const list = (ps: PostLite[]) =>
    ps.slice(0, 3).map((p) => ({
      title: p.t,
      meta: `${p.cat} · ${p.min} min`,
      color: p.c,
    }))
  const plural = (n: number) => `${n} post${n === 1 ? '' : 's'}`
  if (tag) {
    const ps = posts.filter((p) => p.tags.includes(tag))
    return {
      ...b,
      kind: 'topic',
      title: `#${tag}`,
      site: 'Topic',
      description: `${plural(ps.length)} tagged #${tag}.`,
      chips: [plural(ps.length)],
      list: list(ps),
      action: 'Show posts',
    }
  }
  if (cat) {
    const ps = posts.filter((p) => p.cat === cat)
    return {
      ...b,
      kind: 'topic',
      title: cat,
      site: 'Category',
      description: `${plural(ps.length)} in ${cat}.`,
      chips: [plural(ps.length)],
      color: ps[0]?.c,
      list: list(ps),
      action: 'Show posts',
    }
  }
  if (u.searchParams.get('saved')) {
    return {
      ...b,
      kind: 'topic',
      title: 'Saved posts',
      site: 'Your reading list',
      description: 'Posts you bookmarked, kept on this device only.',
      chips: ['Private', 'No account'],
      action: 'Show saved',
    }
  }
  if (u.hash === '#topics') {
    const cats = [...new Set(posts.map((p) => p.cat))]
    return {
      ...b,
      kind: 'topic',
      title: 'Topics',
      site: 'Gul’s Notebook',
      description: 'Browse by category or tag.',
      chips: [plural(posts.length)],
      list: cats.map((c) => {
        const ps = posts.filter((p) => p.cat === c)
        return { title: c, meta: plural(ps.length), color: ps[0]?.c }
      }),
      action: 'Browse topics',
    }
  }
  return null
}

function fallback(a: HTMLAnchorElement, u: URL, loading: boolean): Preview {
  const b = base(a, u)
  const brand = brandFor(b.host)
  const site = brand?.name ?? b.host
  return {
    ...b,
    kind: 'web',
    title: u.pathname.length > 1 ? titleFromPath(u) : site,
    description: loading ? undefined : brand?.about,
    site,
    color: brand?.color,
    chips: [],
    action: actionFor('web', { ...b, site }),
    loading,
  }
}

/* ------------------------------------------------------- in-page links */

const clip = (t: string, n: number) => {
  const v = t.replace(/\s+/g, ' ').trim()
  return v.length > n ? `${v.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : v
}
/** Visible text, with line breaks between blocks (list items don't run together). */
const textOf = (el: Element | null) => ((el instanceof HTMLElement ? el.innerText : el?.textContent) || '').replace(/[↩↑#]/g, ' ').replace(/\s+/g, ' ').trim()

/** The element an in-page link (#id) points to, if it's on this page. */
export function inPageTarget(a: HTMLAnchorElement): HTMLElement | null {
  const u = urlOf(a)
  if (!u || !isBrowser || u.origin !== location.origin || u.pathname !== location.pathname || u.search !== location.search || u.hash.length < 2) return null
  try {
    const el = document.getElementById(decodeURIComponent(u.hash.slice(1)))
    return el && el !== document.body && !el.contains(a) ? el : null
  } catch {
    return null
  }
}

/** Sections (title, first paragraph, length) and citations (the cited work's own card). */
function inPage(a: HTMLAnchorElement, u: URL, target: HTMLElement): Preview | { cite: HTMLAnchorElement; label: string; text: string } {
  const b = { ...base(a, u), external: false, newTab: false, display: `#${safeDecode(u.hash.slice(1))}` }
  const ref = target.closest('li, .footnotes li, [role="doc-endnote"], [role="doc-biblioentry"]')
  if (ref && (/^(ref|fn|cite|note|user-content-fn)/i.test(target.id) || target.closest('.b-refs, .footnotes, [role="doc-bibliography"], [role="doc-endnotes"]'))) {
    const n = [...(ref.parentElement?.children ?? [])].indexOf(ref) + 1
    const label = `${ref.closest('.footnotes, [role="doc-endnotes"]') ? 'Note' : 'Reference'} ${n || ''}`.trim()
    const link = ref.querySelector<HTMLAnchorElement>('a[href^="http"]')
    const text = clip(textOf(ref), 300)
    if (link) return { cite: link, label, text }
    return { ...b, kind: 'cite', title: label, description: text, site: 'On this page', chips: [], action: 'Jump to reference', hint: 'jumps to it' }
  }
  const heading = /^H[1-6]$/.test(target.tagName) ? target : target.querySelector('h1, h2, h3, h4, h5, h6')
  const level = heading ? Number(heading.tagName[1]) : 7
  let words = 0
  let para = ''
  // walk forward until the next heading of the same or a higher level
  let el: Element | null = heading && heading === target ? target.nextElementSibling : (heading?.nextElementSibling ?? target.firstElementChild)
  while (el && words < 4000) {
    if (/^H[1-6]$/.test(el.tagName) && Number(el.tagName[1]) <= level) break
    const t = textOf(el)
    words += t ? t.split(' ').length : 0
    if (!para && el.matches('p, blockquote, li, dd') && t.length > 30) para = t
    if (!para && t.length > 60 && !el.matches('pre, figure, table')) para = t
    el = el.nextElementSibling
  }
  const title = clip(textOf(heading) || target.getAttribute('aria-label') || textOf(target), 120) || 'Section'
  const min = Math.max(1, Math.round(words / 230))
  return {
    ...b,
    kind: 'section',
    title,
    description: para ? clip(para, 240) : undefined,
    site: 'On this page',
    chips: words > 40 ? [`${min} min read`] : [],
    icon: undefined,
    action: 'Jump to section',
    hint: 'jumps to section',
  }
}

/* ------------------------------------------------------- browser cache */

interface Stored {
  at: number
  e: Entry
}
const STORE_KEY = 'gul:lp:v2'
const FRESH_MS = 24 * 3600e3 // serve without asking again
const KEEP_MS = 14 * 24 * 3600e3 // serve stale, refresh in the background
const FAIL_MS = 20 * 60e3 // remember a failure briefly
const STORE_MAX = 160
let store: Record<string, Stored> | null = null
let saveTimer = 0

function readStore(): Record<string, Stored> {
  if (store) return store
  store = {}
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') as Record<string, Stored>
    const now = Date.now()
    for (const [k, v] of Object.entries(raw)) if (v?.e && now - v.at < (v.e.ok ? KEEP_MS : FAIL_MS)) store[k] = v
    // (the old per-session format)
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('gul:lp:')) sessionStorage.removeItem(k)
  } catch {
    /* private mode, or corrupt: start empty */
  }
  return store
}

function persist() {
  const s = readStore()
  const keys = Object.keys(s)
  if (keys.length > STORE_MAX) for (const k of keys.sort((a, b) => s[a].at - s[b].at).slice(0, keys.length - STORE_MAX)) delete s[k]
  for (let tries = 0; tries < 3; tries++) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s))
      return
    } catch {
      // quota: drop the oldest half and try again
      const ks = Object.keys(s).sort((a, b) => s[a].at - s[b].at)
      for (const k of ks.slice(0, Math.ceil(ks.length / 2))) delete s[k]
    }
  }
}

function remember(key: string, e: Entry) {
  readStore()[key] = { at: Date.now(), e }
  if (!isBrowser) return
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(persist, 500)
}

// another tab learned something: use it
if (isBrowser) {
  window.addEventListener('storage', (ev) => {
    if (ev.key === STORE_KEY) store = null
  })
}

/* ---------------------------------------------------- live fetch queue */

type Priority = 'now' | 'idle'
interface Result {
  e: Entry | null
  why?: 'offline' | 'error'
}
interface Job {
  url: string
  key: string
  pri: Priority
  done: (r: Result) => void
}
const MAX_ACTIVE = 3
const queue: Job[] = []
const jobs = new Map<string, Job>()
const live = new Map<string, Promise<Result>>()
let active = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const offline = () => isBrowser && navigator.onLine === false

/** Canonical URL for the API (no hash or tracking parameters), so the edge cache is shared. */
function apiUrl(u: string) {
  const url = new URL(u)
  url.hash = ''
  for (const k of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|mc_eid|mc_cid|igshid|ref_src|si)$/i.test(k)) url.searchParams.delete(k)
  url.searchParams.sort()
  return url.href
}

/** One request with a timeout; one retry for network errors, 5xx and 429 (honouring Retry-After). */
async function request(url: string): Promise<Result> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (offline()) return { e: null, why: 'offline' }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12_000)
    try {
      const r = await fetch(`/api/link-preview?url=${encodeURIComponent(apiUrl(url))}`, { signal: ctrl.signal, credentials: 'omit', headers: { Accept: 'application/json' } })
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) return { e: (await r.json()) as Entry }
      if (r.status === 400 || r.status === 403 || r.status === 404) return { e: { ok: 0 } }
      const wait = r.status === 429 ? Math.min(4, Number(r.headers.get('retry-after')) || 2) * 1000 : 700
      if (attempt === 0) await sleep(wait * (0.75 + Math.random() * 0.5))
    } catch {
      if (attempt === 0) await sleep(600 + Math.random() * 400)
    } finally {
      clearTimeout(timer)
    }
  }
  return { e: null, why: offline() ? 'offline' : 'error' }
}

function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    queue.sort((a, b) => (a.pri === b.pri ? 0 : a.pri === 'now' ? -1 : 1))
    const job = queue.shift()!
    active++
    request(job.url)
      .then((r) => {
        if (r.e) remember(job.key, r.e)
        job.done(r)
      })
      .finally(() => {
        active--
        jobs.delete(job.key)
        live.delete(job.key)
        pump()
      })
  }
}

/** Queue a live fetch (deduplicated; a hover upgrades a queued background prefetch). */
function fetchLive(url: string, key: string, pri: Priority): Promise<Result> {
  const queued = jobs.get(key)
  if (queued && pri === 'now') queued.pri = 'now'
  const hit = live.get(key)
  if (hit) return hit
  const p = new Promise<Result>((done) => {
    const job: Job = { url, key, pri, done }
    jobs.set(key, job)
    queue.push(job)
  })
  live.set(key, p)
  pump()
  return p
}

/** What this browser already knows about a link: fresh, stale (show it, refresh it) or nothing. */
function cached(key: string): { e: Entry; fresh: boolean } | null {
  const c = readStore()[key]
  if (!c) return null
  const age = Date.now() - c.at
  if (!c.e.ok) return age < FAIL_MS ? { e: c.e, fresh: true } : null
  return { e: c.e, fresh: age < FRESH_MS }
}

/* ------------------------------------------------------------------- API */

export function urlOf(a: HTMLAnchorElement): URL | null {
  try {
    return new URL(a.href)
  } catch {
    return null
  }
}

/**
 * Resolve a link. `now` is what to show immediately; `later` (if present)
 * resolves to a better card once data arrives.
 */
export function resolve(a: HTMLAnchorElement, pri: Priority = 'now'): { now: Preview; later?: Promise<Preview> } | null {
  const u = urlOf(a)
  if (!u) return null
  const target = inPageTarget(a)
  if (target) {
    const r = inPage(a, u, target)
    if (!('cite' in r)) return { now: r }
    // a citation: show the cited work's own card, labelled
    const inner = resolve(r.cite, pri)
    const dress = (p: Preview): Preview => ({
      ...p,
      key: previewKey(u),
      href: u.href,
      newTab: false,
      chips: [r.label, ...p.chips.filter((c) => c !== r.label)].slice(0, 4),
      description: p.description || r.text,
      action: 'Jump to reference',
      hint: 'jumps to the reference',
    })
    if (!inner) return null
    return { now: dress(inner.now), later: inner.later?.then(dress) }
  }
  const built = builtIn(a, u)
  if (built) return { now: built }

  const fromManifest = (m: Manifest | null): Preview | null => {
    if (!m) return null
    const topic = blogTopic(a, u, m)
    if (topic) return topic
    const e = m.e[previewKey(u)] ?? (isOwn(u) ? m.e[u.pathname.replace(/\/+$/, '') || '/'] : undefined)
    if (e?.ok) return fromEntry(a, u, e)
    return null
  }
  const now = fromManifest(manifest)
  if (now) return { now }

  const own = isOwn(u)
  const key = previewKey(u)
  const known = own ? null : cached(key)
  // fresh in this browser: instant
  if (known?.fresh && known.e.ok && manifest) return { now: fromEntry(a, u, known.e) }

  const later = loadManifest().then(async (m) => {
    const p = fromManifest(m)
    if (p) return p
    const failedIcon = m?.e[key]?.i
    if (own)
      return {
        ...fallback(a, u, false),
        site: 'Gul’s Notebook',
        action: 'Open page',
      }
    const c = cached(key)
    if (c?.fresh) return c.e.ok ? fromEntry(a, u, c.e) : { ...fallback(a, u, false), icon: c.e.i || failedIcon, failed: 'error' as const }
    const r = await fetchLive(u.href, key, pri)
    if (r.e?.ok) return fromEntry(a, u, r.e)
    // the network let us down: an old copy beats nothing
    if (c?.e.ok) return fromEntry(a, u, c.e)
    return { ...fallback(a, u, false), icon: r.e?.i || failedIcon, failed: r.why ?? ('error' as const) }
  })
  // stale copy: show it right away while the fresh one loads
  if (known?.e.ok) return { now: fromEntry(a, u, known.e), later }
  return {
    now: {
      ...fallback(a, u, true),
      ...(own ? { site: 'Gul’s Notebook' } : {}),
    },
    later,
  }
}

/** Load a link's data ahead of time (hover intent, touch start, or idle prefetch). */
export function prefetch(a: HTMLAnchorElement, pri: Priority = 'idle') {
  const u = urlOf(a)
  if (!u || inPageTarget(a) || !/^https?:$/.test(u.protocol)) return
  void loadManifest().then((m) => {
    const key = previewKey(u)
    if (isOwn(u) || m?.e[key]?.ok || cached(key)?.fresh) return
    void fetchLive(u.href, key, pri)
  })
}

/**
 * Lazy prefetch: links that stay on screen for a moment are looked up while
 * the browser is idle, so their cards open complete. Skipped on Save-Data or
 * slow connections, capped per page, and only for links the build missed.
 */
export function watchLinks(isEligible: (a: HTMLAnchorElement) => boolean): () => void {
  if (!isBrowser || !('IntersectionObserver' in window)) return () => {}
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')) return () => {}
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
  let budget = 16
  const seen = new WeakSet<Element>()
  const timers = new Map<Element, number>()
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const a = en.target as HTMLAnchorElement
        if (en.isIntersecting) {
          if (timers.has(a)) continue
          timers.set(
            a,
            window.setTimeout(() => {
              timers.delete(a)
              io.unobserve(a)
              if (budget <= 0 || !a.isConnected) return
              ric(
                () => {
                  void loadManifest().then((m) => {
                    const u = urlOf(a)
                    if (!u) return
                    const key = previewKey(u)
                    if (isOwn(u) || m?.e[key]?.ok || cached(key)?.fresh || budget <= 0) return
                    budget--
                    void fetchLive(u.href, key, 'idle')
                  })
                },
                { timeout: 3000 },
              )
            }, 800),
          )
        } else {
          clearTimeout(timers.get(a))
          timers.delete(a)
        }
      }
    },
    { rootMargin: '120px 0px' },
  )
  const scan = (root: ParentNode) => {
    root.querySelectorAll?.<HTMLAnchorElement>('a[href^="http"], a[href^="//"]').forEach((a) => {
      if (seen.has(a)) return
      seen.add(a)
      const u = urlOf(a)
      if (u && !isOwn(u) && isEligible(a)) io.observe(a)
    })
  }
  let pending = false
  const mo = new MutationObserver(() => {
    if (pending) return
    pending = true
    ric(() => {
      pending = false
      scan(document.body)
    })
  })
  ric(() => scan(document.body))
  mo.observe(document.body, { childList: true, subtree: true })
  return () => {
    io.disconnect()
    mo.disconnect()
    timers.forEach((t) => clearTimeout(t))
  }
}

/** Start loading the card's images early (on hover intent), once each. */
const warmed = new Set<string>()
export function warmImages(p: Preview) {
  for (const src of [p.image, p.avatar, p.icon]) {
    if (src && !src.startsWith('data:') && !warmed.has(src)) {
      if (warmed.size > 300) warmed.clear()
      warmed.add(src)
      const img = new Image()
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.src = src
    }
  }
}
