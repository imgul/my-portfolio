/**
 * Server renderer used at build time by scripts/prerender.mjs
 * (built with `vite build --ssr src/blog/ssr.tsx`). Renders every blog page to
 * static HTML so readers, search engines and AI crawlers get the full text
 * without running JavaScript; the browser then hydrates it.
 */
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { setServerLocation } from './router'
import { registerBodies, getBody, type Body } from './content'
import { posts, CATEGORY_COLOR, type PostMeta } from './data'
import { Faq, mdxComponents, PostContext, References, StaticContext } from './components/mdx'
import { CoverArtSvg } from './components/CoverArt'
import BlogApp from './BlogApp'

registerBodies(import.meta.glob<{ default: Body }>('./posts/*.mdx', { eager: true }))

export { posts }

/** Full page body for a URL ("/blog", "/blog/<slug>" or "404"). */
export function renderPage(url: string) {
  const notFound = url === '404'
  setServerLocation(notFound ? '/blog/404' : url)
  return renderToString(<BlogApp notFound={notFound} />)
}

/** Clean article HTML (no buttons or UI chrome) for feeds and Markdown copies. */
export function renderArticle(slug: string) {
  const p = posts.find((x) => x.slug === slug)
  const Body = getBody(slug)
  if (!p || !Body) return ''
  return renderToStaticMarkup(
    <StaticContext.Provider value={true}>
      <PostContext.Provider value={p}>
        <Body components={mdxComponents} />
        <Faq items={p.faq} />
        <References />
      </PostContext.Provider>
    </StaticContext.Provider>,
  )
}

/** The post's generative cover as a standalone SVG with real colours (for OG images). */
export function coverSvg(p: PostMeta, bg: string, second: string) {
  return renderToStaticMarkup(<CoverArtSvg art={p.art} seed={p.slug} color={CATEGORY_COLOR[p.category]} bg={bg} second={second} />)
}

export const categoryColor = (p: PostMeta) => CATEGORY_COLOR[p.category]
