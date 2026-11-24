/**
 * Link preview data. Sources, best first:
 *  1. /link-previews.json, written at build time (scripts/link-previews.mjs):
 *     every link on the site, with favicons saved locally
 *  2. built in: email, phone and WhatsApp links, blog topics and saved posts
 *  3. /api/link-preview?url=… (live fetch for links the build missed)
 *  4. a card built from the URL alone (brand name, colour, monogram)
 */
import { BRANDS } from './brands'

export type Kind = 'web' | 'article' | 'post' | 'page' | 'file' | 'feed' | 'repo' | 'profile' | 'paper' | 'email' | 'phone' | 'chat' | 'topic'

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
  const last = path.split('/').filter(Boolean).pop() ?? ''
  if (!last) return host
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

/* ------------------------------------------------------------ live fetch */

const live = new Map<string, Promise<Entry | null>>()
const LIVE_KEY = 'gul:lp:'

function fetchLive(url: string, key: string): Promise<Entry | null> {
  const hit = live.get(key)
  if (hit) return hit
  let stored: Entry | null = null
  try {
    stored = JSON.parse(sessionStorage.getItem(LIVE_KEY + key) || 'null')
  } catch {
    /* private mode */
  }
  if (stored) return Promise.resolve(stored)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  const p = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
    signal: ctrl.signal,
    credentials: 'omit',
  })
    .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? (r.json() as Promise<Entry>) : null))
    .then((e) => {
      if (e) {
        try {
          sessionStorage.setItem(LIVE_KEY + key, JSON.stringify(e))
        } catch {
          /* full */
        }
      }
      return e
    })
    .catch(() => null)
    .finally(() => clearTimeout(timer))
  live.set(key, p)
  return p
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
export function resolve(a: HTMLAnchorElement): { now: Preview; later?: Promise<Preview> } | null {
  const u = urlOf(a)
  if (!u) return null
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
  const later = loadManifest().then(async (m) => {
    const p = fromManifest(m)
    if (p) return p
    const key = previewKey(u)
    const failedIcon = m?.e[key]?.i
    if (own)
      return {
        ...fallback(a, u, false),
        site: 'Gul’s Notebook',
        action: 'Open page',
      }
    const e = await fetchLive(u.href, key)
    if (e?.ok) return fromEntry(a, u, e)
    return { ...fallback(a, u, false), icon: e?.i || failedIcon }
  })
  return {
    now: {
      ...fallback(a, u, true),
      ...(own ? { site: 'Gul’s Notebook' } : {}),
    },
    later,
  }
}

/** Start loading the card's images early (on hover intent). */
export function warmImages(p: Preview) {
  for (const src of [p.image, p.avatar, p.icon]) {
    if (src && !src.startsWith('data:')) {
      const img = new Image()
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.src = src
    }
  }
}
