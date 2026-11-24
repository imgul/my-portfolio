import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypePrettyCode from 'rehype-pretty-code'
import { loadPosts, writeBlogFiles, SITE_URL, POSTS_DIR } from './scripts/blog.mjs'

const VIRTUAL = 'virtual:blog'
const RESOLVED = '\0' + VIRTUAL

/**
 * Blog plugin:
 *  - `virtual:blog` exports the post index (frontmatter + reading time), no post bodies
 *  - hot-reloads the index when a post is added/edited in dev
 *  - after a build writes rss.xml, feed.json, sitemap.xml, robots.txt and a
 *    pre-rendered HTML shell per post with the right title / description / OG tags
 */
function blog(): Plugin {
  let outDir = 'dist'
  let isBuild = false
  return {
    name: 'gul-blog',
    configResolved(c) {
      outDir = c.build.outDir.startsWith('/') ? c.build.outDir : `${c.root}/${c.build.outDir}`
      isBuild = c.command === 'build'
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED
    },
    load(id) {
      if (id !== RESOLVED) return
      const posts = loadPosts(POSTS_DIR, { includeDrafts: !isBuild })
      return `export const posts = ${JSON.stringify(posts)}\nexport const SITE_URL = ${JSON.stringify(SITE_URL)}`
    },
    configureServer(server) {
      server.watcher.add(POSTS_DIR)
      const reload = (file: string) => {
        if (!file.replace(/\\/g, '/').startsWith(POSTS_DIR)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
      server.watcher.on('change', (f) => f.endsWith('.mdx') && reload(f))
    },
    writeBundle() {
      writeBlogFiles(outDir)
    },
  }
}

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath],
        rehypePlugins: [
          rehypeKatex,
          rehypeSlug,
          [
            rehypePrettyCode,
            {
              theme: { dark: 'github-dark-dimmed', light: 'github-light' },
              keepBackground: false,
              defaultLang: 'plaintext',
            },
          ],
        ],
      }),
    },
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    blog(),
  ],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap')) return 'gsap'
        },
      },
    },
  },
})
