declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const MDXContent: ComponentType<{ components?: Record<string, unknown> }>
  export default MDXContent
}

declare module 'virtual:blog' {
  import type { PostMeta } from './data'
  export const posts: PostMeta[]
  export const SITE_URL: string
  /** shared with scripts/blog.mjs so the client-side <head> matches the pre-rendered one */
  export const SEO: { BLOG_TITLE: string; BLOG_INDEX_TITLE: string; BLOG_DESCRIPTION: string; RESEARCH_DESCRIPTION: string; NOT_FOUND_DESCRIPTION: string }
}
