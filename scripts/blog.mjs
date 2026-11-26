/**
 * Blog content pipeline, shared by the Vite plugin (virtual:blog index in dev
 * and build) and scripts/prerender.mjs (static HTML, feeds, sitemap, llms.txt,
 * Markdown copies and Open Graph images).
 *
 * A post is one MDX file in src/blog/posts/<slug>.mdx with YAML frontmatter:
 *
 *   title:        required, aim for 30–65 characters (search results truncate ~60)
 *   description:  required, 70–160 characters (Google cuts off longer); used for cards, meta description, feeds
 *   seoTitle:     optional, a shorter <title> for search results (the page headline is unchanged)
 *
 *   Every post gets its <head> (title, description, canonical, Open Graph, Twitter, JSON-LD),
 *   a 1200×630 share image at /og/<slug>.png, a sitemap entry and feed items automatically.
 *   date:         required, YYYY-MM-DD. A future date schedules the post: it stays out of production builds
 *                 (page, feeds, sitemap, JS) until that day in PUBLISH_TZ; .github/workflows/publish-scheduled.yml
 *                 redeploys each morning a post is due. Never set a past date for a post published today.
 *   updated:      optional, YYYY-MM-DD (shown as "Updated", used as dateModified)
 *   category:     Founder | Engineering | AI Research | Writing
 *   tags:         [list, of, tags] (1–8)
 *   seriesSlug:   optional series key (must match a `slug` in src/blog/series.mjs)
 *   seriesPart:   optional number (1, 2, 3…), unique within the series; required with seriesSlug
 *   seriesStage:  optional stage title within the series (must match a stage in the registry)
 *   series:       legacy series name; resolved to a seriesSlug + registry title (prefer seriesSlug)
 *   featured:     optional, true pins it as the featured post
 *   draft:        optional, true hides it in production builds
 *   art:          cover art: galaxy | dna | road | city | book | stack | network | tree | mountains | globe
 *   cover:        featured image, rendered by scripts/covers.mjs: { style, alt, …style fields }. See docs/COVERS.md.
 *   level:        optional: Beginner | Intermediate | Advanced
 *   references:   optional list of { id, title, authors, year, venue, url } for <Cite id="…" />
 *   faq:          optional list of { q, a }: rendered at the end + FAQPage structured data
 *   license:      optional: CC-BY-4.0 | all-rights-reserved (default: CC BY for AI Research,
 *                 Engineering and Writing; all rights reserved for Founder; see src/blog/scholar.mjs)
 *   doi:          optional DOI (e.g. 10.59350/abcde-12345), minted for free by Rogue Scholar
 *                 for open posts; `npm run blog:dois` fills it in automatically
 *   references[].doi: optional DOI of a cited work (preferred over url for citation tracking)
 *
 * Run `npm run lint:blog` to check posts against the guidelines in docs/BLOG_GUIDELINES.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import { analyse, prose as slopProse } from './slop.mjs'
import { LEGAL, LEGAL_UPDATED } from '../src/blog/legal.mjs'
import { AUTHOR as PERSON_INFO, BLOG_NAME, DOI_RE, LICENSES, PROFILES, activeProfiles, citationMeta, doiUrl, licenseFor, sameAs } from '../src/blog/scholar.mjs'
import { SERIES, SERIES_STATUSES, seriesBySlug } from '../src/blog/series.mjs'

export const SITE_URL = (process.env.VITE_SITE_URL || 'https://gulzaib.vercel.app').replace(/\/$/, '')
/** Author identity lives in src/blog/scholar.mjs (shared with the browser). */
export const AUTHOR = { ...PERSON_INFO, url: SITE_URL, sameAs: sameAs() }
const LINKEDIN = PROFILES.find((p) => p.id === 'linkedin')?.url || SITE_URL
export const BLOG_TITLE = BLOG_NAME
export const BLOG_DESCRIPTION =
  'Notes from building AI-native SaaS: founder lessons, engineering deep dives, AI systems research and the craft of technical writing, by Muhammad Gulzaib.'
export const CATEGORIES = ['Founder', 'Engineering', 'AI Research', 'Writing']
/** IndexNow (Bing, Yandex, Seznam, Naver): the key file is published at /<key>.txt. */
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'f3b9c27e6a5d4e81b0c4d2a97e15b6c8'
/** URLs under /blog/ that are pages, not posts. */
export const RESERVED_SLUGS = ['research', 'series']
/** The series registry file (watched in dev so edits reload the blog index). */
export const SERIES_FILE = fileURLToPath(new URL('../src/blog/series.mjs', import.meta.url)).replace(/\\\\/g, '/')
export const ARTS = ['galaxy', 'dna', 'road', 'city', 'book', 'stack', 'network', 'tree', 'mountains', 'globe']
/** Keep in sync with STYLES in scripts/covers.mjs (not imported here, so blog.mjs stays free of sharp/resvg). */
export const COVER_STYLES = ['number', 'versus', 'code', 'image', 'headline', 'quote', 'face', 'list', 'mockup', 'terminal']

/** Absolute path of the posts folder (forward slashes). */
export const POSTS_DIR = fileURLToPath(new URL('../src/blog/posts', import.meta.url)).replace(/\\/g, '/')
/** Content hash per cover, written by scripts/covers.mjs; appended as ?v= so a changed cover is never served stale. */
export function coverVersions() {
  const f = fileURLToPath(new URL('../public/covers/manifest.json', import.meta.url))
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}
}

const WPM = 230
const toISO = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : undefined)
const stripCode = (src) => src.replace(/^```[\s\S]*?^```/gm, '')

/** Strip MDX/markdown syntax to count words that a reader actually reads. */
function plainText(src) {
  return src
    .replace(/```[\s\S]*?```/g, (m) => ' ' + m.split('\n').slice(1, -1).join(' ').replace(/[^\w\s]/g, ' ') + ' ')
    // keep visible text that lives in props (step titles, captions, pros/cons, chart labels)
    .replace(/<[^>]+>/g, (m) => ' ' + (m.match(/"[^"]*"/g) || []).filter((q) => /\s/.test(q)).join(' ').replace(/"/g, ' ') + ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/[#>*_`~[\](){}|-]/g, ' ')
}

/** h2/h3 headings with the same ids rehype-slug generates (for the TOC, rendered without JS). */
function extractHeadings(content) {
  const slugger = new GithubSlugger()
  const out = []
  for (const line of stripCode(content).split('\n')) {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const text = m[2]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
      .replace(/<[^>]+>/g, '')
      .trim()
    const id = slugger.slug(text)
    if (m[1].length === 2 || m[1].length === 3) out.push({ depth: m[1].length, text, id })
  }
  return out
}

/** Scheduled posts go live on their date in the author's timezone. */
export const PUBLISH_TZ = 'Asia/Karachi'
/** Today's date (YYYY-MM-DD) in PUBLISH_TZ. PUBLISH_DATE=YYYY-MM-DD overrides it (previews, tests). */
export const todayISO = () => process.env.PUBLISH_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: PUBLISH_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/** Hidden from production: drafts, and posts whose date has not arrived yet. */
export const isPublished = (p, today = todayISO()) => !p.draft && p.date <= today

export function loadPosts(dir = POSTS_DIR, { includeDrafts = false } = {}) {
  if (!fs.existsSync(dir)) return []
  const posts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      const { data, content } = matter(raw)
      const slug = file.replace(/\.mdx$/, '')
      const words = plainText(content).split(/\s+/).filter(Boolean).length
      const codeBlocks = (content.match(/```/g) || []).length / 2
      return {
        slug,
        title: String(data.title ?? slug),
        description: String(data.description ?? ''),
        seoTitle: data.seoTitle ? String(data.seoTitle) : undefined,
        date: toISO(data.date) ?? '1970-01-01',
        updated: toISO(data.updated),
        category: data.category ?? 'Engineering',
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        // the registry is the source of truth for series names: a legacy `series: <name>`
        // resolves to its slug, and the display name comes from the registry entry
        seriesSlug: data.seriesSlug ? String(data.seriesSlug) : data.series ? slug(String(data.series)) : undefined,
        series: (() => {
          const s = data.seriesSlug ? seriesBySlug(String(data.seriesSlug)) : data.series ? seriesBySlug(slug(String(data.series))) : undefined
          return s ? s.title : data.series ? String(data.series) : undefined
        })(),
        seriesPart: data.seriesPart ? Number(data.seriesPart) : undefined,
        seriesStage: data.seriesStage ? String(data.seriesStage) : undefined,
        featured: !!data.featured,
        draft: !!data.draft,
        scheduled: (toISO(data.date) ?? '1970-01-01') > todayISO(),
        art: data.art ?? 'galaxy',
        cover: data.cover && typeof data.cover === 'object' ? { ...data.cover, style: String(data.cover.style ?? '') } : undefined,
        level: data.level,
        references: Array.isArray(data.references)
          ? data.references.map((r) => ({
              id: String(r.id),
              title: String(r.title ?? ''),
              authors: r.authors ? String(r.authors) : undefined,
              year: r.year ? String(r.year) : undefined,
              venue: r.venue ? String(r.venue) : undefined,
              url: r.url ? String(r.url) : undefined,
              doi: r.doi ? String(r.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : undefined,
            }))
          : [],
        license: licenseFor(data.category ?? 'Engineering', data.license),
        doi: data.doi ? String(data.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim() : undefined,
        faq: Array.isArray(data.faq) ? data.faq.filter((f) => f && f.q && f.a).map((f) => ({ q: String(f.q), a: String(f.a) })) : [],
        headings: extractHeadings(content),
        words,
        // code takes longer to read than prose
        minutes: Math.max(1, Math.round(words / WPM + codeBlocks * 0.4)),
      }
    })
    .filter((p) => includeDrafts || isPublished(p))
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)))
}

/* ----------------------------------------------------------------- search */

/** Readable plain text of a markdown/MDX fragment, for search snippets (keeps punctuation, unlike plainText). */
function readable(md) {
  return md
    .replace(/^(import|export)\s.*$/gm, ' ')
    .replace(/^```.*$/gm, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    // JSX: keep visible text that lives in props (titles, captions, pros/cons), drop the tag itself
    .replace(/<[^>]+>/g, (m) => ' ' + (m.match(/"[^"]*"/g) || []).filter((q) => /\s/.test(q)).map((q) => q.slice(1, -1)).join('. ') + ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\^[^\]]*\]/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\W)[*_](\S.*?\S|\S)[*_](?=\W|$)/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.|>|\|)\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^[\s:-]+$/gm, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Full-text search index: for each post, its sections (intro + every h2/h3) as
 * `{ id, h, t }` (heading id, heading text, plain text). Loaded lazily by the
 * search dialog (virtual:blog-search), so it never weighs on the first page load.
 */
export function searchIndex(dir = POSTS_DIR, { includeDrafts = false } = {}) {
  const out = {}
  for (const p of loadPosts(dir, { includeDrafts })) {
    const { content } = matter(fs.readFileSync(path.join(dir, `${p.slug}.mdx`), 'utf8'))
    const slugger = new GithubSlugger()
    const sections = [{ id: '', h: '', lines: [] }]
    let fence = false
    for (const line of content.split('\n')) {
      if (/^```/.test(line)) fence = !fence
      const m = !fence && /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
      if (m) {
        const h = readable(m[2])
        sections.push({ id: slugger.slug(h), h, lines: [] })
      } else sections.at(-1).lines.push(line)
    }
    // use the exact ids the TOC uses when the heading count lines up (it always should)
    if (sections.length - 1 === p.headings.length) p.headings.forEach((h, i) => (sections[i + 1].id = h.id))
    out[p.slug] = sections.map((s) => ({ id: s.id, h: s.h, t: readable(s.lines.join('\n')) })).filter((s) => s.h || s.t)
  }
  return out
}

/* ------------------------------------------------------------------- lint */

/**
 * Checks every post against docs/BLOG_GUIDELINES.md. Returns { errors, warnings }.
 * Errors break things (bad frontmatter, broken links); warnings are advice.
 */
export function lintPosts(dir = POSTS_DIR) {
  const errors = []
  const warnings = []
  // the series registry is the series "database": validate it like frontmatter
  const seenSlugs = new Set()
  for (const s of SERIES) {
    const err = (m) => errors.push(`series "${s.slug}": ${m}`)
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.slug)) err('slug must be lowercase-with-hyphens (it becomes the URL)')
    if (seenSlugs.has(s.slug)) err('duplicate series slug')
    seenSlugs.add(s.slug)
    if (!s.title) err('missing title')
    if (!s.description) err('missing description')
    if (!SERIES_STATUSES.includes(s.status)) err(`status must be one of ${SERIES_STATUSES.join(', ')}`)
    const stagePos = new Set()
    for (const st of s.stages) {
      if (stagePos.has(st.position)) err(`duplicate stage position ${st.position}`)
      stagePos.add(st.position)
      if (!st.title) err('stage without a title')
    }
    const partPos = new Set()
    for (const pp of s.plannedPosts) {
      if (partPos.has(pp.position)) err(`duplicate planned part ${pp.position}`)
      partPos.add(pp.position)
      if (!pp.title) err(`planned part ${pp.position} without a title`)
      if (pp.stage && s.stages.length && !s.stages.some((st) => st.title === pp.stage)) err(`planned part ${pp.position} names unknown stage "${pp.stage}"`)
      if (pp.scheduledDate && Number.isNaN(Date.parse(pp.scheduledDate))) err(`planned part ${pp.position} has an invalid scheduledDate`)
    }
  }
  const posts = loadPosts(dir, { includeDrafts: true })
  const slugs = new Set(posts.map((p) => p.slug))
  const descs = new Map()
  for (const p of posts) {
    const err = (m) => errors.push(`${p.slug}: ${m}`)
    const warn = (m) => warnings.push(`${p.slug}: ${m}`)
    const { content } = matter(fs.readFileSync(path.join(dir, `${p.slug}.mdx`), 'utf8'))
    const body = stripCode(content)

    if (!/^[a-z0-9][a-z0-9-]*$/.test(p.slug)) err('file name must be lowercase-with-hyphens (it becomes the URL)')
    if (RESERVED_SLUGS.includes(p.slug)) err(`"${p.slug}" is a reserved page URL; rename the file`)
    // remark-math reads "$0.50 … $0.525" as inline math, so prices must be written \$0.50
    const money = body.replace(/`[^`\n]*`/g, '').match(/(?<![\\$])\$\d[\d,.]*(?![\d,.]*[/^_\\{}+*=<>-])/)
    if (money) err(`"${money[0]}" will render as math: escape the dollar sign: \\${money[0]}`)
    if (!p.title || p.title === p.slug) err('missing title')
    else if (p.title.length > 70) warn(`title is ${p.title.length} chars; search results show ~60`)
    else if (p.title.length < 20) warn(`title is only ${p.title.length} chars; be more specific`)
    if (!p.description) err('missing description')
    else if (p.description.length < 70 || p.description.length > 160) warn(`description is ${p.description.length} chars; aim for 70–160 (Google cuts off longer)`)
    if (descs.has(p.description)) warn(`same description as ${descs.get(p.description)}`)
    descs.set(p.description, p.slug)
    if (p.date === '1970-01-01' || Number.isNaN(Date.parse(p.date))) err('missing or invalid date (YYYY-MM-DD)')
    if (p.updated && p.updated < p.date) err('updated is before date')
    if (!CATEGORIES.includes(p.category)) err(`category must be one of ${CATEGORIES.join(', ')}`)
    if (!ARTS.includes(p.art)) err(`art must be one of ${ARTS.join(', ')}`)
    if (p.cover) {
      if (!COVER_STYLES.includes(p.cover.style)) err(`cover.style must be one of ${COVER_STYLES.join(', ')}`)
      if (!p.cover.alt) err('cover.alt is required: describe what the featured image shows (it has text in it)')
      if (p.cover.style === 'image' && !fs.existsSync(path.join(POSTS_DIR, '../../../assets/covers', p.cover.file ?? `${p.slug}.png`))) err(`cover image assets/covers/${p.cover.file ?? `${p.slug}.png`} not found`)
    } else warn('no cover: add a featured image (docs/COVERS.md); posts with a cover get more clicks from cards and shares')
    const fm = matter(fs.readFileSync(path.join(dir, `${p.slug}.mdx`), 'utf8')).data
    if (fm.license && !LICENSES[fm.license]) err(`license must be one of ${Object.keys(LICENSES).join(', ')}`)
    if (p.doi && !DOI_RE.test(p.doi)) err(`doi "${p.doi}" is not a DOI (10.xxxx/…)`)
    if (p.doi && !LICENSES[p.license].open) warn('has a DOI but is not open access; DOI registries expect an open licence')
    for (const r of p.references) {
      if (r.doi && !DOI_RE.test(r.doi)) err(`reference "${r.id}" has an invalid doi "${r.doi}"`)
      if (!r.doi && !r.url && !r.venue) warn(`reference "${r.id}" has no doi or url; citation trackers (Crossref, Rogue Scholar) only see linked references`)
    }
    if (!p.tags.length) warn('add 1–8 tags')
    if (p.tags.length > 8) warn('more than 8 tags dilutes topics')
    if (p.tags.some((t) => t !== t.toLowerCase())) warn('use lowercase tags')
    if (!/<(TLDR|Abstract)>/.test(content)) warn('start with a <TLDR> (or <Abstract>): an answer-first summary helps readers, search snippets and AI answers')
    if (/^# /m.test(body)) err('do not use "# " (h1) in the body; the title is the only h1')

    let last = 1
    for (const line of body.split('\n')) {
      const m = /^(#{2,6})\s/.exec(line)
      if (!m) continue
      const d = m[1].length
      if (d > last + 1) warn(`heading level jumps from h${last} to h${d}: "${line.trim()}"`)
      last = d
    }
    if (p.headings.filter((h) => h.depth === 2).length < 2 && p.words > 600) warn('long post with fewer than 2 sections (## headings)')

    for (const m of body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) if (!m[1].trim()) err(`image without alt text: ${m[2]}`)
    for (const m of body.matchAll(/<(img|Figure)\b[^>]*\bsrc=/g)) {
      const tag = body.slice(m.index, body.indexOf('>', m.index) + 1)
      if (!/\balt="[^"]+"/.test(tag)) err(`<${m[1]}> without alt text`)
    }
    for (const m of body.matchAll(/\]\((\/blog\/[^)#?\s]+)/g)) if (!slugs.has(m[1].slice(6))) err(`broken internal link ${m[1]}`)
    for (const m of body.matchAll(/<PostLink\s+slug="([^"]+)"/g)) if (!slugs.has(m[1])) err(`<PostLink> to missing post "${m[1]}"`)
    for (const m of body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) if (m[1].startsWith('http://')) warn(`insecure link ${m[1]}`)
    for (const m of body.matchAll(/\[(here|click here|this|link)\]\(/gi)) warn(`vague link text "${m[1]}": describe where the link goes`)

    const refIds = new Set(p.references.map((r) => r.id))
    const cited = new Set([...body.matchAll(/<Cite\s+id="([^"]+)"/g)].map((m) => m[1]))
    for (const id of cited) if (!refIds.has(id)) err(`<Cite id="${id}"> has no matching reference`)
    for (const id of refIds) if (!cited.has(id)) warn(`reference "${id}" is never cited`)

    if (p.seriesSlug) {
      const def = seriesBySlug(p.seriesSlug)
      if (!def) err(`seriesSlug "${p.seriesSlug}" is not in src/blog/series.mjs`)
      else {
        if (!p.seriesPart) err('series posts need seriesPart (the part number)')
        if (p.seriesStage && def.stages.length && !def.stages.some((st) => st.title === p.seriesStage)) err(`seriesStage "${p.seriesStage}" is not a stage of "${def.title}"`)
      }
    }
    if (p.seriesSlug && p.seriesPart && posts.some((q) => q !== p && q.seriesSlug === p.seriesSlug && q.seriesPart === p.seriesPart)) err(`duplicate seriesPart ${p.seriesPart} in series "${p.seriesSlug}"`)
    if (p.words < 300 && !p.draft) warn(`only ${p.words} words; thin pages rank and get cited less`)

    // AI tells (rules from .agents/skills/humanizer + stop-slop); run `npm run lint:slop` for the full report
    const slop = analyse(slopProse(content) + '\n\n' + p.title + '. ' + p.description)
    for (const f of slop.flags.filter((x) => x.weight >= 4)) warn(`AI tell (${f.label}): “${f.text}”. Say the specific thing instead`)
    if (slop.score < 90) warn(`slop score ${slop.score}/100; rewrite flagged passages in your own words (npm run lint:slop -- src/blog/posts/${p.slug}.mdx)`)
  }
  // Renamed posts: every /blog/<old> redirect must land on a real post and must not shadow one.
  const vercel = path.join(dir, '../../../vercel.json')
  if (dir === POSTS_DIR && fs.existsSync(vercel)) {
    const redirects = JSON.parse(fs.readFileSync(vercel, 'utf8')).redirects ?? []
    const sources = new Set(redirects.map((r) => r.source))
    for (const r of redirects) {
      if (sources.has(r.destination)) errors.push(`vercel.json: redirect ${r.source} points to another redirect ${r.destination} (chain or loop)`)
      const from = /^\/blog\/([a-z0-9-]+)$/.exec(r.source)?.[1]
      if (!from) continue
      const to = /^\/blog\/([a-z0-9-]+)$/.exec(r.destination)?.[1]
      if (slugs.has(from)) errors.push(`vercel.json: redirect from /blog/${from} hides a post that still exists`)
      if (to && !slugs.has(to)) errors.push(`vercel.json: redirect /blog/${from} points to /blog/${to}, which is not a post`)
    }
  }
  return { errors, warnings, count: posts.length }
}

/* ------------------------------------------------------------------ feeds */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
export const postUrl = (p) => `${SITE_URL}/blog/${p.slug}`
/**
 * Share images live at /og/<key>.png (key: a post slug, or home | blog | research | 404).
 * The build stamps each URL with a hash of the image (?v=…), so Facebook, LinkedIn,
 * Slack and X fetch the new picture whenever a title or the artwork changes.
 */
const OG_VERSIONS = {}
export const setOgVersions = (map) => Object.assign(OG_VERSIONS, map)
export const ogUrl = (key) => `${SITE_URL}/og/${key}.png${OG_VERSIONS[key] ? `?v=${OG_VERSIONS[key]}` : ''}`
export const ogImage = (p) => ogUrl(p ? p.slug : 'blog')

export function rss(posts, html = {}) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${postUrl(p)}</link>
      <guid isPermaLink="true">${postUrl(p)}</guid>
      <pubDate>${new Date(p.date + 'T09:00:00Z').toUTCString()}</pubDate>
      <dc:creator>${esc(AUTHOR.name)}</dc:creator>
      <description>${esc(p.description)}</description>
      <dc:rights>${esc(rightsText(p))}</dc:rights>${LICENSES[p.license].open ? `\n      <cc:license>${LICENSES[p.license].url}</cc:license>` : ''}${
        p.doi ? `\n      <dc:identifier>${doiUrl(p.doi)}</dc:identifier>` : ''
      }
      <category>${esc(p.category)}</category>${p.tags.map((t) => `\n      <category>${esc(t)}</category>`).join('')}${
        html[p.slug] ? `\n      <content:encoded>${cdata(html[p.slug])}</content:encoded>` : ''
      }
      <enclosure url="${ogImage(p)}" type="image/png" length="0" />
    </item>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://web.resource.org/cc/">
  <channel>
    <title>${esc(BLOG_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
    <description>${esc(BLOG_DESCRIPTION)}</description>
    <language>en</language>
    <copyright>© ${new Date().getFullYear()} ${esc(AUTHOR.name)}. AI Research, Engineering and Writing posts: CC BY 4.0. Founder posts: all rights reserved. Code: MIT.</copyright>
    <managingEditor>${AUTHOR.email} (${esc(AUTHOR.name)})</managingEditor>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image><url>${ogImage()}</url><title>${esc(BLOG_TITLE)}</title><link>${SITE_URL}/blog</link></image>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}

const rightsText = (p) => {
  const lic = LICENSES[p.license]
  return lic.open ? `© ${p.date.slice(0, 4)} ${AUTHOR.name}. ${lic.name} (${lic.url})` : `© ${p.date.slice(0, 4)} ${AUTHOR.name}. All rights reserved.`
}

/**
 * Atom feed of open-access (CC BY) posts only, with full text, ORCID, licence and
 * DOIs. This is the feed to register with Rogue Scholar (rogue-scholar.org), which
 * archives each post, mints a free Crossref DOI and pushes it to ORCID, OpenAlex,
 * Semantic Scholar and other indexes.
 */
export function openAccessAtom(posts, html = {}) {
  const open = posts.filter((p) => LICENSES[p.license].open)
  const updated = open.map((p) => p.updated ?? p.date).sort().at(-1) ?? new Date().toISOString().slice(0, 10)
  const lic = LICENSES['CC-BY-4.0']
  const author = `<author><name>${esc(AUTHOR.name)}</name><uri>${AUTHOR.orcidUrl}</uri></author>`
  const entries = open
    .map(
      (p) => `  <entry>
    <id>${postUrl(p)}</id>
    <title>${esc(p.title)}</title>
    <link rel="alternate" type="text/html" href="${postUrl(p)}" />${p.doi ? `\n    <link rel="related" href="${doiUrl(p.doi)}" title="DOI" />` : ''}
    <link rel="alternate" type="application/pdf" href="${postUrl(p)}.pdf" />
    <link rel="license" href="${lic.url}" />
    <published>${p.date}T09:00:00+05:00</published>
    <updated>${p.updated ?? p.date}T09:00:00+05:00</updated>
    ${author}
    <rights>${esc(rightsText(p))}</rights>
    <summary>${esc(p.description)}</summary>
    <category term="${esc(p.category)}" />${p.tags.map((t) => `\n    <category term="${esc(t)}" />`).join('')}${
      html[p.slug] ? `\n    <content type="html">${esc(html[p.slug])}</content>` : ''
    }
  </entry>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <id>${SITE_URL}/blog</id>
  <title>${esc(BLOG_TITLE)}: open-access research &amp; engineering notes</title>
  <subtitle>${esc(BLOG_DESCRIPTION)} Posts in this feed are licensed ${lic.short}.</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}/feeds/open-access.xml" />
  <link rel="alternate" type="text/html" href="${SITE_URL}/blog" />
  <link rel="license" href="${lic.url}" />
  <icon>${SITE_URL}/favicon.svg</icon>
  <logo>${ogImage()}</logo>
  <updated>${updated}T09:00:00+05:00</updated>
  ${author}
  <rights>© ${esc(AUTHOR.name)}. ${lic.name} (${lic.url})</rights>
  <generator uri="${SITE_URL}/blog">Gul’s Notebook prerender</generator>
${entries}
</feed>
`
}

export function jsonFeed(posts, html = {}, { feedPath = '/feed.json', title = BLOG_TITLE } = {}) {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title,
      home_page_url: `${SITE_URL}/blog`,
      feed_url: `${SITE_URL}${feedPath}`,
      description: BLOG_DESCRIPTION,
      language: 'en',
      authors: [{ name: AUTHOR.name, url: AUTHOR.orcidUrl }],
      items: posts.map((p) => ({
        id: postUrl(p),
        url: postUrl(p),
        title: p.title,
        summary: p.description,
        content_html: html[p.slug],
        image: ogImage(p),
        date_published: `${p.date}T09:00:00Z`,
        date_modified: `${p.updated ?? p.date}T09:00:00Z`,
        tags: [p.category, ...p.tags],
        language: 'en',
        ...(p.doi ? { external_url: doiUrl(p.doi) } : {}),
        attachments: [{ url: `${postUrl(p)}.pdf`, mime_type: 'application/pdf', title: 'PDF version' }],
        _scholarly: { license: LICENSES[p.license].url || 'all-rights-reserved', rights: rightsText(p), doi: p.doi ?? null, orcid: AUTHOR.orcidUrl },
      })),
    },
    null,
    2,
  )
}

export function sitemap(posts) {
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: posts.map((p) => p.updated ?? p.date).sort().at(-1), image: ogUrl('home') },
    { loc: `${SITE_URL}/blog`, lastmod: posts.map((p) => p.updated ?? p.date).sort().at(-1), image: ogImage() },
    { loc: `${SITE_URL}/blog/lessons`, image: ogUrl('lessons') },
    { loc: `${SITE_URL}/blog/research`, lastmod: posts.filter((p) => LICENSES[p.license].open).map((p) => p.updated ?? p.date).sort().at(-1), image: ogUrl('research') },
    ...SERIES.filter((s) => s.status === 'published').map((s) => ({
      loc: `${SITE_URL}/blog/series/${s.slug}`,
      lastmod: posts.filter((p) => p.seriesSlug === s.slug).map((p) => p.updated ?? p.date).sort().at(-1),
      image: ogUrl(`series-${s.slug}`),
    })),
    ...posts.map((p) => ({ loc: postUrl(p), lastmod: p.updated ?? p.date, image: ogImage(p) })),
    ...LEGAL.map((l) => ({ loc: `${SITE_URL}${l.path}`, lastmod: LEGAL_UPDATED })),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.image ? `<image:image><image:loc>${u.image}</image:loc></image:image>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`
}

/** Search engines and AI assistants are explicitly welcome to read and cite the blog. */
export function robots() {
  const ai = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'Bingbot',
    'DuckAssistBot',
    'Amazonbot',
    'meta-externalagent',
    'CCBot',
  ]
  return `# Search engines and AI assistants are welcome to read, quote and cite this site.
# A plain-text guide for language models lives at ${SITE_URL}/llms.txt

User-agent: *
Allow: /

${ai.map((a) => `User-agent: ${a}`).join('\n')}
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
}

/** https://llmstxt.org: a Markdown map of the site for language models. */
export function llmsTxt(posts) {
  const byCat = CATEGORIES.map((c) => [c, posts.filter((p) => p.category === c)]).filter(([, ps]) => ps.length)
  const series = SERIES.filter((s) => s.status === 'published').map((s) => [s, posts.filter((p) => p.seriesSlug === s.slug).sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0))])
  return `# ${BLOG_TITLE}: Muhammad Gulzaib

> ${BLOG_DESCRIPTION}

Written by Muhammad Gulzaib (Gul), Founder & CEO of SynergyFlow Labs and a senior full stack engineer in Islamabad, Pakistan. Posts are first-hand notes from building SaaS products (Laravel, React), AI systems (RAG, agents) and early-stage companies. Every post has a clean Markdown version (the links below) and the full corpus is at ${SITE_URL}/llms-full.txt.

Citing: please cite posts by author, title, date and URL (or DOI when a post has one), e.g. “Gulzaib, M. (2026). <title>. Gul’s Notebook. <url>”. Author ORCID iD: ${AUTHOR.orcidUrl}. AI Research, Engineering and Writing posts are licensed CC BY 4.0 (reuse with credit); Founder posts are all rights reserved (quote with a link). Each post page offers APA, MLA, Chicago, IEEE, Harvard, BibTeX and RIS citations, and a PDF version.

${byCat
  .map(
    ([c, ps]) => `## ${c}

${ps.map((p) => `- [${p.title}](${postUrl(p)}.md): ${p.description}`).join('\n')}`,
  )
  .join('\n\n')}

## Series

${series
  .map(
    ([s, ps]) =>
      `### [${s.title}](${SITE_URL}/blog/series/${s.slug}): ${s.description} (${ps.length} of ${s.plannedPostCount ?? ps.length} published)\n\n${ps.map((p) => `- Part ${p.seriesPart}: [${p.title}](${postUrl(p)}.md): ${p.description}`).join('\n')}`,
  )
  .join('\n\n')}

## Optional

- [Portfolio](${SITE_URL}/): Muhammad Gulzaib's experience, ventures and skills
- [RSS feed](${SITE_URL}/rss.xml): every post with full content
- [JSON feed](${SITE_URL}/feed.json)
- [Research & citation](${SITE_URL}/blog/research): author identifiers (ORCID${activeProfiles(true).length > 1 ? ', ' + activeProfiles(true).slice(1).map((x) => x.label).join(', ') : ''}), open-access posts and how to cite them
- [Open-access feed](${SITE_URL}/feeds/open-access.xml): CC BY posts with full text (Atom)
`
}

/* ------------------------------------------------------------------- head */

const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

const PERSON = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#person`,
  name: AUTHOR.name,
  givenName: AUTHOR.givenName,
  familyName: AUTHOR.familyName,
  alternateName: 'Gul',
  url: SITE_URL,
  image: `${SITE_URL}/img/gul/gulzaib.jpg`,
  email: `mailto:${AUTHOR.email}`,
  jobTitle: AUTHOR.jobTitle,
  worksFor: { '@type': 'Organization', name: AUTHOR.affiliation },
  homeLocation: { '@type': 'Place', name: AUTHOR.location },
  knowsAbout: AUTHOR.knowsAbout,
  identifier: { '@type': 'PropertyValue', propertyID: 'ORCID', value: AUTHOR.orcid, url: AUTHOR.orcidUrl },
  sameAs: AUTHOR.sameAs,
}
const BLOG = {
  '@type': 'Blog',
  '@id': `${SITE_URL}/blog#blog`,
  name: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  url: `${SITE_URL}/blog`,
  inLanguage: 'en',
  author: { '@id': PERSON['@id'] },
  publisher: { '@id': PERSON['@id'] },
}

function postGraph(p) {
  const url = postUrl(p)
  const sdef = p.seriesSlug ? seriesBySlug(p.seriesSlug) : undefined
  const crumbs = [
    { name: 'Home', item: `${SITE_URL}/` },
    { name: BLOG_TITLE, item: `${SITE_URL}/blog` },
    // a series post's breadcrumb goes through its series landing page
    ...(sdef ? [{ name: sdef.title, item: `${SITE_URL}/blog/series/${sdef.slug}` }] : []),
    { name: p.category, item: `${SITE_URL}/blog?category=${encodeURIComponent(p.category)}` },
    { name: p.title, item: url },
  ]
  const lic = LICENSES[p.license]
  const year = Number(p.date.slice(0, 4))
  const graph = [
    {
      // open posts are also scholarly articles (Google Scholar, Semantic Scholar and Zotero read this)
      '@type': lic.open ? ['BlogPosting', 'ScholarlyArticle'] : 'BlogPosting',
      '@id': `${url}#article`,
      headline: p.title,
      description: p.description,
      image: { '@type': 'ImageObject', url: ogImage(p), width: 1200, height: 630 },
      datePublished: `${p.date}T09:00:00+05:00`,
      dateModified: `${p.updated ?? p.date}T09:00:00+05:00`,
      author: { '@id': PERSON['@id'] },
      publisher: { '@id': PERSON['@id'] },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      isPartOf: { '@id': BLOG['@id'] },
      articleSection: p.category,
      keywords: p.tags,
      wordCount: p.words,
      timeRequired: `PT${p.minutes}M`,
      inLanguage: 'en',
      isAccessibleForFree: true,
      abstract: p.description,
      copyrightHolder: { '@id': PERSON['@id'] },
      copyrightYear: year,
      ...(lic.open
        ? { license: lic.url, encoding: { '@type': 'MediaObject', encodingFormat: 'application/pdf', contentUrl: `${url}.pdf` } }
        : { copyrightNotice: `© ${year} ${AUTHOR.name}. All rights reserved.` }),
      ...(p.doi ? { identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi, url: doiUrl(p.doi) }, sameAs: doiUrl(p.doi) } : {}),
      ...(p.level ? { educationalLevel: p.level } : {}),
      ...(sdef
        ? { isPartOf: [{ '@id': BLOG['@id'] }, { '@type': 'CreativeWorkSeries', name: sdef.title, url: `${SITE_URL}/blog/series/${sdef.slug}` }], position: p.seriesPart }
        : p.series
          ? { isPartOf: [{ '@id': BLOG['@id'] }, { '@type': 'CreativeWorkSeries', name: p.series }], position: p.seriesPart }
          : {}),
      ...(p.references.length
        ? { citation: p.references.map((r) => ({ '@type': 'CreativeWork', name: r.title, ...(r.authors ? { author: r.authors } : {}), ...(r.doi ? { url: doiUrl(r.doi), identifier: r.doi } : r.url ? { url: r.url } : {}), ...(r.year ? { datePublished: r.year } : {}), ...(r.venue ? { isPartOf: r.venue } : {}) })) }
        : {}),
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.b-post__dek', '.b-tldr', '.b-abstract', '.b-takeaways'] },
      accessMode: ['textual', 'visual'],
      accessModeSufficient: ['textual'],
      accessibilityFeature: ['alternativeText', 'tableOfContents', 'readingOrder', 'structuralNavigation', 'displayTransformability', 'highContrastDisplay', 'largePrint'],
      accessibilityHazard: 'none',
    },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) },
    PERSON,
    BLOG,
  ]
  if (p.faq.length)
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    })
  return { '@context': 'https://schema.org', '@graph': graph }
}

function indexGraph(posts) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { ...BLOG, blogPost: posts.map((p) => ({ '@id': `${postUrl(p)}#article` })) },
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/blog#page`,
        url: `${SITE_URL}/blog`,
        name: BLOG_TITLE,
        description: BLOG_DESCRIPTION,
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: AUTHOR.name },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: postUrl(p), name: p.title })),
        },
      },
      PERSON,
    ],
  }
}

/** A series landing page: a CollectionPage of its parts, under the blog's breadcrumb. */
function seriesGraph(s, posts) {
  const url = `${SITE_URL}/blog/series/${s.slug}`
  const items = posts.filter((p) => p.seriesSlug === s.slug).sort((a, b) => (a.seriesPart ?? 0) - (b.seriesPart ?? 0))
  const crumbs = [
    { name: 'Home', item: `${SITE_URL}/` },
    { name: BLOG_TITLE, item: `${SITE_URL}/blog` },
    { name: s.title, item: url },
  ]
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: s.title,
        description: s.description,
        isPartOf: { '@id': BLOG['@id'] },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: postUrl(p), name: p.title })),
        },
      },
      { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) },
      PERSON,
      BLOG,
    ],
  }
}

function researchGraph(posts) {
  const open = posts.filter((p) => LICENSES[p.license].open)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${SITE_URL}/blog/research#page`,
        url: `${SITE_URL}/blog/research`,
        name: `Research & citation · ${BLOG_TITLE}`,
        description: RESEARCH_DESCRIPTION,
        mainEntity: { '@id': PERSON['@id'] },
        isPartOf: { '@id': BLOG['@id'] },
        dateModified: open.map((p) => p.updated ?? p.date).sort().at(-1),
        hasPart: open.map((p) => ({ '@id': `${postUrl(p)}#article` })),
      },
      PERSON,
      BLOG,
    ],
  }
}
export const RESEARCH_DESCRIPTION =
  'How to cite Muhammad Gulzaib’s writing: ORCID iD, research profiles, open-access (CC BY 4.0) posts with DOIs and PDFs, and APA, IEEE and BibTeX citations.'
export const NOT_FOUND_DESCRIPTION = 'This page doesn’t exist. Search Gul’s Notebook or start with a recent post on founding, engineering and AI.'

/** "<post> · Gul’s Notebook", or just the post title when that would be cut off in search results. */
/** The blog index's <title> and share title (search results show ~60 characters). */
export const BLOG_INDEX_TITLE = `${BLOG_TITLE}: founder, engineering and AI notes`
const TWITTER = PERSON_INFO.x ? [`<meta name="twitter:site" content="@${PERSON_INFO.x}" />`, `<meta name="twitter:creator" content="@${PERSON_INFO.x}" />`] : []

export const postTitle = (p) => p.seoTitle ?? (`${p.title} · ${BLOG_TITLE}`.length <= 65 ? `${p.title} · ${BLOG_TITLE}` : p.title)

/** <head> tags for a blog page: SEO, Open Graph, Twitter, feeds, Markdown alternate and JSON-LD. */
export function headTags({ post, posts, notFound, research, legal, series, lessons }) {
  if (legal) return legalHeadTags(legal)
  const title = lessons ? 'Lessons that cost me something · Muhammad Gulzaib' : notFound
    ? `Page not found · ${BLOG_TITLE}`
    : post
      ? postTitle(post)
      : series
        ? (series.seoTitle ?? `${series.title} · ${BLOG_TITLE}`)
        : research
          ? `Research & citation: Muhammad Gulzaib · ${BLOG_TITLE}`
          : BLOG_INDEX_TITLE
  const description = lessons ? 'Founder lessons on validation, sales and building reliable, simple software for shops and schools.' : notFound ? NOT_FOUND_DESCRIPTION : post ? post.description : series ? (series.seoDescription ?? series.description) : research ? RESEARCH_DESCRIPTION : BLOG_DESCRIPTION
  const url = lessons ? `${SITE_URL}/blog/lessons` : post ? postUrl(post) : series ? `${SITE_URL}/blog/series/${series.slug}` : research ? `${SITE_URL}/blog/research` : `${SITE_URL}/blog`
  const lic = post ? LICENSES[post.license] : null
  const img = lessons ? ogUrl('lessons') : post ? ogImage(post) : series ? ogUrl(`series-${series.slug}`) : research ? ogUrl('research') : notFound ? ogUrl('404') : ogUrl('blog')
  const imgAlt = lessons ? 'Lessons that cost me something: founder notes by Muhammad Gulzaib' : post
    ? `${post.title}: ${post.category} post by Muhammad Gulzaib`
    : series
      ? `${series.title}: blog series by Muhammad Gulzaib`
      : research
        ? 'Research and writing by Muhammad Gulzaib: ORCID iD, open-access posts and citation formats'
        : notFound
          ? 'Page not found'
          : `${BLOG_TITLE} by Muhammad Gulzaib: ${posts?.length ?? ''} posts on founding, engineering, AI and writing`
  const t = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="author" content="${esc(AUTHOR.name)}" />`,
    notFound ? `<meta name="robots" content="noindex" />` : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    notFound ? '' : `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(BLOG_TITLE)}" href="${SITE_URL}/rss.xml" />`,
    `<link rel="alternate" type="application/feed+json" title="${esc(BLOG_TITLE)}" href="${SITE_URL}/feed.json" />`,
    `<link rel="alternate" type="application/atom+xml" title="${esc(BLOG_TITLE)}: open-access posts" href="${SITE_URL}/feeds/open-access.xml" />`,
    post ? `<link rel="alternate" type="text/markdown" title="Markdown version" href="${url}.md" />` : `<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE_URL}/llms.txt" />`,
    post ? `<link rel="alternate" type="application/pdf" title="PDF version" href="${url}.pdf" />` : '',
    ...sameAs().map((u) => `<link rel="me" href="${u}" />`),
    lic?.open ? `<link rel="license" href="${lic.url}" />` : '',
    post?.doi ? `<link rel="cite-as" href="${doiUrl(post.doi)}" />` : '',
    // Highwire Press + Dublin Core tags for Google Scholar, Zotero, Mendeley, Semantic Scholar (open posts only)
    ...(post ? citationMeta(post, SITE_URL).map(([n, c]) => `<meta name="${n}" content="${esc(c)}" />`) : []),
    `<meta property="og:site_name" content="${esc(BLOG_TITLE)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:type" content="${post ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${esc(lessons ? title : post ? post.title : series ? (series.seoTitle ?? series.title) : research ? 'Research & citation: Muhammad Gulzaib' : BLOG_INDEX_TITLE)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(imgAlt)}" />`,
    ...(post
      ? [
          `<meta property="article:published_time" content="${post.date}T09:00:00+05:00" />`,
          `<meta property="article:modified_time" content="${post.updated ?? post.date}T09:00:00+05:00" />`,
          `<meta property="article:author" content="${LINKEDIN}" />`,
          `<meta property="article:section" content="${esc(post.category)}" />`,
          ...post.tags.map((tag) => `<meta property="article:tag" content="${esc(tag)}" />`),
        ]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...TWITTER,
    `<meta name="twitter:title" content="${esc(lessons ? title : post ? post.title : series ? (series.seoTitle ?? series.title) : research ? 'Research & citation: Muhammad Gulzaib' : BLOG_INDEX_TITLE)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc(imgAlt)}" />`,
    // shown under link unfurls in Slack, Discord and others
    ...(post
      ? [
          `<meta name="twitter:label1" content="Reading time" />`,
          `<meta name="twitter:data1" content="${post.minutes} min read" />`,
          `<meta name="twitter:label2" content="Filed under" />`,
          `<meta name="twitter:data2" content="${esc(post.category)}" />`,
        ]
      : []),
    notFound ? '' : `<script type="application/ld+json">${json(lessons ? { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url, author: PERSON } : post ? postGraph(post) : series ? seriesGraph(series, posts) : research ? researchGraph(posts) : indexGraph(posts))}</script>`,
  ]
  return t.filter(Boolean).join('\n    ')
}

/** The graph for /privacy, /terms, /cookies: a WebPage of the site, published by the author. */
function legalGraph(l) {
  const url = `${SITE_URL}${l.path}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: l.title,
        description: l.description,
        inLanguage: 'en',
        dateModified: LEGAL_UPDATED,
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: PERSON_INFO.name },
        publisher: { '@id': PERSON['@id'] },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: l.title, item: url },
          ],
        },
      },
      PERSON,
    ],
  }
}

/** <head> tags for a legal page (src/blog/legal.mjs); mirrors src/blog/head.ts → legalHead. */
export function legalHeadTags(l) {
  const title = `${l.title} · ${PERSON_INFO.name}`
  const ogTitle = `${l.title}: ${SITE_URL.replace(/^https?:\/\//, '')}`
  const url = `${SITE_URL}${l.path}`
  const img = ogUrl('legal')
  const imgAlt = `${l.title} for ${PERSON_INFO.name}’s portfolio and ${BLOG_TITLE}`
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(l.description)}" />`,
    `<meta name="author" content="${esc(AUTHOR.name)}" />`,
    `<meta name="robots" content="index, follow, max-snippet:-1" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${esc(PERSON_INFO.name)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(ogTitle)}" />`,
    `<meta property="og:description" content="${esc(l.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(imgAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...TWITTER,
    `<meta name="twitter:title" content="${esc(ogTitle)}" />`,
    `<meta name="twitter:description" content="${esc(l.description)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc(imgAlt)}" />`,
    `<script type="application/ld+json">${json(legalGraph(l))}</script>`,
  ].join('\n    ')
}

/**
 * Turn the built index.html into a blog page: page-specific head, the blog's
 * CSS/JS preloaded (no flash of unstyled content) and pre-rendered HTML in #root.
 */
export function pageHtml(indexHtml, { head, preload = '', body = '' }) {
  return indexHtml
    .replace(/\s*<!-- seo -->[\s\S]*?<!-- \/seo -->/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace(/\s*<link rel="alternate"[^>]*>/g, '')
    .replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '')
    .replace('</head>', `    ${head}\n    ${preload}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-ssr="1">${body}</div>`)
}

/* ------------------------------------------------------- the landing page */

/** Title, description and share text for the portfolio, all from src/data/content.ts. */
export function homeMeta({ profile, ventures }) {
  const company = ventures.find((v) => /founder/i.test(v.role) && /company/i.test(v.kicker)) ?? ventures[0]
  const role = company ? company.role.replace(/^\w/, (c) => c.toLowerCase()) : 'founder'
  const building = ventures.filter((v) => /founder/i.test(v.role)).slice(0, 3).map((v) => v.name)
  const list = building.length > 1 ? `${building.slice(0, -1).join(', ')} and ${building.at(-1)}` : building[0]
  // the longest version that fits a search snippet (~160 characters)
  const description =
    [
      `${profile.name}, ${role} of ${company?.name}: a senior full stack engineer building AI-native SaaS with Laravel, React and agentic AI in ${profile.location}.`,
      `${profile.name}, ${role} of ${company?.name}: a senior full stack engineer building AI-native SaaS in ${profile.location}.`,
      `${profile.name}: ${profile.role}. ${profile.location}.`,
    ].find((d) => d.length <= 160) ?? `${profile.name}: ${profile.role}.`
  return {
    title: `${profile.name}: ${profile.role}`,
    description,
    ogTitle: `${profile.name}: ${profile.tagline}`,
    ogDescription: `${profile.headline}. Building ${list}. ${profile.availability}.`,
  }
}

function homeGraph({ profile, ventures, manifesto, education, stack, languages }, posts, meta) {
  const founded = ventures.filter((v) => /founder/i.test(v.role))
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: profile.name,
        alternateName: [profile.short, BLOG_TITLE],
        description: meta.description,
        inLanguage: 'en',
        publisher: { '@id': PERSON['@id'] },
        // the blog has search (?q=), which lets Google show a search box for the site
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/blog?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      },
      {
        '@type': 'ProfilePage',
        '@id': `${SITE_URL}/#page`,
        url: `${SITE_URL}/`,
        name: meta.title,
        description: meta.description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        mainEntity: { '@id': PERSON['@id'] },
        about: { '@id': PERSON['@id'] },
        primaryImageOfPage: { '@type': 'ImageObject', url: ogUrl('home'), width: 1200, height: 630 },
        dateModified: posts.map((p) => p.updated ?? p.date).sort().at(-1),
        hasPart: { '@id': BLOG['@id'] },
      },
      {
        ...PERSON,
        description: manifesto,
        jobTitle: profile.role,
        knowsAbout: [...new Set([...AUTHOR.knowsAbout, ...stack.flatMap((g) => g.skills.filter((k) => k.level >= 5).map((k) => k.name))])],
        knowsLanguage: languages.map((l) => l.name),
        alumniOf: { '@type': 'CollegeOrUniversity', name: education.school, url: education.url },
        hasOccupation: { '@type': 'Occupation', name: 'Senior Full Stack Engineer', skills: profile.headline },
        worksFor: founded.slice(0, 1).map((v) => ({ '@id': `${SITE_URL}/#org-${slug(v.name)}` }))[0],
      },
      ...founded.map((v) => ({
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org-${slug(v.name)}`,
        name: v.name,
        description: `${v.tagline} ${v.body}`,
        ...(v.url ? { url: v.url } : {}),
        founder: { '@id': PERSON['@id'] },
      })),
      BLOG,
    ],
  }
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** <head> tags for the portfolio landing page. */
export function homeHeadTags(content, posts) {
  const meta = homeMeta(content)
  const img = ogUrl('home')
  const alt = `${content.profile.name}, ${content.profile.role}: ${content.profile.tagline}`
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="author" content="${esc(AUTHOR.name)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<link rel="canonical" href="${SITE_URL}/" />`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(BLOG_TITLE)}" href="${SITE_URL}/rss.xml" />`,
    `<link rel="alternate" type="text/plain" title="llms.txt" href="${SITE_URL}/llms.txt" />`,
    ...sameAs().map((u) => `<link rel="me" href="${u}" />`),
    `<meta property="og:site_name" content="${esc(content.profile.name)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="profile:first_name" content="${esc(AUTHOR.givenName)}" />`,
    `<meta property="profile:last_name" content="${esc(AUTHOR.familyName)}" />`,
    `<meta property="og:title" content="${esc(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${esc(meta.ogDescription)}" />`,
    `<meta property="og:url" content="${SITE_URL}/" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...TWITTER,
    `<meta name="twitter:title" content="${esc(meta.ogTitle)}" />`,
    `<meta name="twitter:description" content="${esc(meta.ogDescription)}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${esc(alt)}" />`,
    `<script type="application/ld+json">${json(homeGraph(content, posts, meta))}</script>`,
  ].join('\n    ')
}

/**
 * Plain-HTML summary of the portfolio for visitors and crawlers without JavaScript
 * (link unfurlers, AI crawlers, text browsers). Same facts as the interactive page.
 */
/**
 * The landing page's server-side summary, rendered inside #root. Crawlers that don't run
 * JavaScript (and link checkers) see a real <h1>, the ventures, recent posts and contact links;
 * React replaces it on mount. It is visually hidden while the app loads and shown when
 * JavaScript is off (the <noscript> style in homeHeadTags).
 */
export function homeNoscript({ profile, ventures, manifesto }, posts) {
  const li = (s) => `<li>${s}</li>`
  return `<main class="pre" id="pre">
        <h1>${esc(profile.name)}: ${esc(profile.role)}</h1>
        <p><strong>${esc(profile.tagline)}</strong> ${esc(profile.headline)} · ${esc(profile.location)}</p>
        <p>${esc(manifesto)}</p>
        <h2>Ventures</h2>
        <ul>${ventures.map((v) => li(`<strong>${v.url ? `<a href="${v.url}">${esc(v.name)}</a>` : esc(v.name)}</strong> (${esc(v.role)}): ${esc(v.tagline)} ${esc(v.body)}`)).join('')}</ul>
        <h2>Latest from <a href="${SITE_URL}/blog">${esc(BLOG_TITLE)}</a></h2>
        <ul>${posts.slice(0, 6).map((p) => li(`<a href="${postUrl(p)}">${esc(p.title)}</a>: ${esc(p.description)}`)).join('')}</ul>
        <h2>Contact</h2>
        <p><a href="mailto:${profile.email}">${esc(profile.email)}</a> · ${profile.socials.filter((x) => /^https?:/.test(x.url)).map((x) => `<a href="${x.url}" rel="me">${esc(x.label)}</a>`).join(' · ')} · ${esc(profile.availability)}</p>
      </main>`
}

/** Hides the summary above while the app boots; shows it as a readable page when JavaScript is off. */
const PRE_STYLE = [
  `<style>.pre{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}</style>`,
  `<noscript><style>body{margin:0;background:#07070a}.pre{position:static;width:auto;height:auto;overflow:visible;clip-path:none;white-space:normal;max-width:44rem;margin:0 auto;padding:3rem 1.25rem;font:16px/1.6 system-ui,sans-serif;color:#ecebe6;background:#07070a}.pre a{color:#c6ff3d}</style></noscript>`,
].join('\n    ')

/** The built index.html with the landing page's generated head and no-JS summary. */
export function homeHtml(indexHtml, { head, noscript }) {
  const [top, body] = indexHtml.split(/(?=<body)/)
  if (!body || !body.includes('<div id="root"></div>')) throw new Error('homeHtml: <div id="root"></div> not found in index.html')
  return (
    top.replace(/<!-- seo -->[\s\S]*?<!-- \/seo -->/, `<!-- seo -->\n    ${head}\n    ${PRE_STYLE}\n    <!-- /seo -->`) +
    // the summary replaces index.html's one-line <noscript> fallback
    body.replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '').replace('<div id="root"></div>', `<div id="root">\n      ${noscript}\n    </div>`)
  )
}
