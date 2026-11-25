import type { PostMeta } from '../data'
import { CATEGORY_COLOR } from '../data'
import { CoverArt } from './CoverArt'

/**
 * A post's featured image: the rendered cover at /covers/<slug>.webp (scripts/covers.mjs),
 * or the generative art for posts without a `cover:` block.
 *
 * `alt` defaults to empty because cards and link cards repeat the title right next to the
 * image; the post header passes the real description.
 */
export function PostCover({ p, sizes = '(max-width: 720px) 100vw, 400px', eager = false, alt = '', color }: { p: PostMeta; sizes?: string; eager?: boolean; alt?: string; color?: string }) {
  if (!p.cover) return <CoverArt art={p.art} seed={p.slug} color={color ?? CATEGORY_COLOR[p.category]} />
  const q = p.cover.v ? `?v=${p.cover.v}` : ''
  return (
    <img
      className="cover-img"
      src={`/covers/${p.slug}.webp${q}`}
      srcSet={`/covers/${p.slug}-640.webp${q} 640w, /covers/${p.slug}.webp${q} 1200w`}
      sizes={sizes}
      width={1200}
      height={630}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : undefined}
    />
  )
}
