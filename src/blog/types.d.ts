declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const MDXContent: ComponentType<{ components?: Record<string, unknown> }>
  export default MDXContent
}

declare module 'virtual:blog' {
  import type { PostMeta } from './data'
  export const posts: PostMeta[]
  export const SITE_URL: string
}
