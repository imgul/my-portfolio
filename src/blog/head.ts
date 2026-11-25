/**
 * Keeps <head> in sync on client-side navigation. Pre-rendered pages already
 * ship the right tags (scripts/blog.mjs → headTags); this mirrors them when the
 * reader moves between pages without a reload, so the tab title, bookmarks,
 * "share" sheets, the canonical URL and JavaScript-rendering crawlers all see
 * the page they are actually on.
 */
import { SEO, SITE_URL, type PostMeta } from './data'

export interface Head {
  title: string
  description: string
  /** path for canonical / og:url, e.g. /blog/my-post */
  path: string
  /** og image key: a post slug, or blog | research | 404 */
  image: string
  imageAlt: string
  type?: 'website' | 'article'
  noindex?: boolean
  /** og:title / twitter:title when it differs from the title minus the blog name */
  ogTitle?: string
}

function set(sel: string, attr: string, val: string | null) {
  let el = document.head.querySelector(sel)
  if (val === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement(sel.startsWith('link') ? 'link' : 'meta')
    for (const [, k, v] of sel.matchAll(/\[([\w:-]+)="([^"]+)"\]/g)) el.setAttribute(k, v)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, val)
}

/** Keep the hashed image URL the build wrote, if it's the same image. */
function imageUrl(key: string) {
  const current = document.head.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
  return current.includes(`/og/${key}.png`) ? current : `${SITE_URL}/og/${key}.png`
}

export function setHead(h: Head) {
  if (typeof document === 'undefined') return
  const url = `${SITE_URL}${h.path}`
  const img = imageUrl(h.image)
  const ogTitle = h.ogTitle ?? h.title.replace(` · ${SEO.BLOG_TITLE}`, '')
  document.title = h.title
  set('meta[name="description"]', 'content', h.description)
  set('meta[name="robots"]', 'content', h.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
  set('link[rel="canonical"]', 'href', h.noindex ? null : url)
  set('meta[property="og:type"]', 'content', h.type ?? 'website')
  set('meta[property="og:title"]', 'content', ogTitle)
  set('meta[property="og:description"]', 'content', h.description)
  set('meta[property="og:url"]', 'content', url)
  set('meta[property="og:image"]', 'content', img)
  set('meta[property="og:image:alt"]', 'content', h.imageAlt)
  set('meta[name="twitter:title"]', 'content', ogTitle)
  set('meta[name="twitter:description"]', 'content', h.description)
  set('meta[name="twitter:image"]', 'content', img)
  set('meta[name="twitter:image:alt"]', 'content', h.imageAlt)
}

export const postHead = (p: PostMeta): Head => ({
  // same rule as scripts/blog.mjs → postTitle: drop the blog name when it would be cut off
  title: p.seoTitle ?? (`${p.title} · ${SEO.BLOG_TITLE}`.length <= 65 ? `${p.title} · ${SEO.BLOG_TITLE}` : p.title),
  ogTitle: p.title,
  description: p.description,
  path: `/blog/${p.slug}`,
  image: p.slug,
  imageAlt: `${p.title}: ${p.category} post by Muhammad Gulzaib`,
  type: 'article',
})

/** The index, including filtered views (?category, ?tag, ?q, saved), which canonicalise to /blog. */
export function indexHead({ q, tag, cat, saved, count }: { q?: string; tag?: string; cat?: string; saved?: boolean; count: number }): Head {
  const what = saved ? 'Saved posts' : q ? `Search: “${q}”` : tag ? `#${tag}` : cat ? `${cat} posts` : ''
  return {
    title: what ? `${what} · ${SEO.BLOG_TITLE}` : SEO.BLOG_INDEX_TITLE,
    ogTitle: what ? undefined : SEO.BLOG_INDEX_TITLE,
    description: what && !saved ? `${count} ${count === 1 ? 'post' : 'posts'}${tag ? ` tagged #${tag}` : cat ? ` in ${cat}` : q ? ` matching “${q}”` : ''} on ${SEO.BLOG_TITLE}. ${SEO.BLOG_DESCRIPTION}` : SEO.BLOG_DESCRIPTION,
    path: '/blog',
    image: 'blog',
    imageAlt: `${SEO.BLOG_TITLE} by Muhammad Gulzaib`,
    // search results and personal lists aren't pages worth indexing
    noindex: !!(q || saved),
  }
}

export const researchHead = (): Head => ({
  title: `Research & citation: Muhammad Gulzaib · ${SEO.BLOG_TITLE}`,
  description: SEO.RESEARCH_DESCRIPTION,
  path: '/blog/research',
  image: 'research',
  imageAlt: 'Research and writing by Muhammad Gulzaib: ORCID iD, open-access posts and citation formats',
})

export const notFoundHead = (): Head => ({
  title: `Page not found · ${SEO.BLOG_TITLE}`,
  description: SEO.NOT_FOUND_DESCRIPTION,
  path: '/404',
  image: '404',
  imageAlt: 'Page not found',
  noindex: true,
})

/** /privacy, /terms, /cookies (titles and descriptions live in ./legal.mjs, shared with the build). */
export const legalHead = (m: { path: string; title: string; description: string }): Head => ({
  title: `${m.title} · Muhammad Gulzaib`,
  ogTitle: `${m.title}: gulzaib.vercel.app`,
  description: m.description,
  path: m.path,
  image: 'legal',
  imageAlt: `${m.title} for Muhammad Gulzaib’s portfolio and Gul’s Notebook`,
})
