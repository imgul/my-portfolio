import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypePrettyCode from 'rehype-pretty-code'
import { loadPosts, coverVersions, searchIndex, SITE_URL, POSTS_DIR, BLOG_TITLE, BLOG_DESCRIPTION, BLOG_INDEX_TITLE, RESEARCH_DESCRIPTION, NOT_FOUND_DESCRIPTION } from './scripts/blog.mjs'

const VIRTUAL = 'virtual:blog'
const RESOLVED = '\0' + VIRTUAL
// full text of every post, split by section: its own lazily loaded chunk, used only by the search dialog
const SEARCH = 'virtual:blog-search'
const SEARCH_RESOLVED = '\0' + SEARCH

/**
 * Blog plugin:
 *  - `virtual:blog` exports the post index (frontmatter + reading time), no post bodies
 *  - hot-reloads the index when a post is added/edited in dev
 *  (static HTML, feeds, sitemap, llms.txt, Markdown copies and OG images are
 *   generated after the build by scripts/prerender.mjs)
 */
/**
 * Production builds leave out the bodies of drafts and scheduled posts. Their pages are never
 * generated, and this keeps their text out of the JS chunks too, so nothing leaks before the date.
 */
function unpublishedPosts(): Plugin {
  let live: Set<string> | null = null
  return {
    name: 'gul-unpublished-posts',
    enforce: 'pre',
    apply: 'build',
    buildStart() {
      live = new Set(loadPosts(POSTS_DIR).map((p) => String(p.slug)))
    },
    load(id) {
      const m = id.match(/[\\/]src[\\/]blog[\\/]posts[\\/]([a-z0-9-]+)\.mdx$/)
      if (m && live && !live.has(m[1])) return '{/* not published yet */}'
    },
  }
}

/** Removes unpublished posts from the lazy `import.meta.glob` map in src/blog/content.ts, so not even their slug ships. */
function unpublishedGlobEntries(): Plugin {
  return {
    name: 'gul-unpublished-glob',
    enforce: 'post',
    apply: 'build',
    transform(code, id) {
      if (!/[\\/]src[\\/]blog[\\/]content\.ts$/.test(id)) return
      const live = new Set(loadPosts(POSTS_DIR).map((p) => String(p.slug)))
      let removed = 0
      const out = code.replace(/\s*["']\.\/posts\/([a-z0-9-]+)\.mdx["']\s*:\s*\(\)\s*=>\s*import\(\s*["'][^"']+["']\s*\)\s*,?/g, (entry, slug: string) =>
        live.has(slug) ? entry : (removed++, ''),
      )
      if (removed && !out.includes('import.meta.glob')) return { code: out, map: null }
    },
  }
}

function blog(): Plugin {
  let isBuild = false
  return {
    name: 'gul-blog',
    configResolved(c) {
      isBuild = c.command === 'build'
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED
      if (id === SEARCH) return SEARCH_RESOLVED
    },
    load(id) {
      if (id === SEARCH_RESOLVED) return `export const sections = ${JSON.stringify(searchIndex(POSTS_DIR, { includeDrafts: !isBuild }))}`
      if (id !== RESOLVED) return
      // the client only needs to know a cover exists (and its alt text); the rest is for scripts/covers.mjs
      const v = coverVersions()
      const posts = loadPosts(POSTS_DIR, { includeDrafts: !isBuild }).map((p) => ({ ...p, cover: p.cover ? { style: p.cover.style, alt: String(p.cover.alt ?? ''), v: v[p.slug] ?? '' } : undefined }))
      const seo = { BLOG_TITLE, BLOG_INDEX_TITLE, BLOG_DESCRIPTION, RESEARCH_DESCRIPTION, NOT_FOUND_DESCRIPTION }
      return `export const posts = ${JSON.stringify(posts)}\nexport const SITE_URL = ${JSON.stringify(SITE_URL)}\nexport const SEO = ${JSON.stringify(seo)}`
    },
    configureServer(server) {
      server.watcher.add(POSTS_DIR)
      const reload = (file: string) => {
        if (!file.replace(/\\/g, '/').startsWith(POSTS_DIR)) return
        for (const m of [RESOLVED, SEARCH_RESOLVED]) {
          const mod = server.moduleGraph.getModuleById(m)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
      server.watcher.on('change', (f) => f.endsWith('.mdx') && reload(f))
    },
  }
}

/**
 * Link previews in dev / preview: serves /link-previews.json (built in memory,
 * icons inlined) and /api/link-preview (the same handler as the Vercel function).
 * In production both come from the build (scripts/link-previews.mjs) and api/.
 */
function linkPreviews(): Plugin {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
  let manifest: Promise<Record<string, unknown>> | null = null
  // (no @types/node here, so the Node request / response are typed loosely)
  const middleware: Connect.NextHandleFunction = (req, response, next) => {
    const url = (req as unknown as { url?: string }).url || ''
    const res = response as unknown as { setHeader(k: string, v: string): void; end(b: string): void }
    if (url.startsWith('/api/link-preview')) {
      import('./scripts/link-meta.mjs').then(({ previewHandler }) => previewHandler(req, res)).catch(next)
      return
    }
    if (url.split('?')[0] === '/link-previews.json') {
      manifest ??= import('./scripts/link-previews.mjs').then(({ buildManifest }) =>
        buildManifest({ fetchExternal: env.LINK_PREVIEWS !== 'off', log: (m) => console.log(`  ${m}`) }),
      )
      manifest
        .then((m) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(JSON.stringify(m))
        })
        .catch((e) => {
          manifest = null
          next(e)
        })
      return
    }
    next()
  }
  return {
    name: 'gul-link-previews',
    configureServer(server) {
      server.middlewares.use(middleware)
      // a post changed: rebuild on the next request
      server.watcher.on('change', (f) => f.endsWith('.mdx') && (manifest = null))
    },
    configurePreviewServer(server) {
      // the built dist/link-previews.json is served as a static file
      server.middlewares.use((req, res, next) => ((req as unknown as { url?: string }).url?.startsWith('/api/') ? middleware(req, res, next) : next()))
    },
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    unpublishedPosts(),
    unpublishedGlobEntries(),
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
              // high-contrast light theme: github-light's red (#d73a49) is 4.0:1 on the code background
              theme: { dark: 'github-dark-dimmed', light: 'github-light-high-contrast' },
              keepBackground: false,
              defaultLang: 'plaintext',
            },
          ],
        ],
      }),
    },
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    blog(),
    linkPreviews(),
  ],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: isSsrBuild
    ? {
        outDir: '.ssr',
        emptyOutDir: true,
        copyPublicDir: false,
        rollupOptions: {
          // the server bundle imports every post eagerly on purpose
          onwarn(w: { code?: string }, warn: (w: never) => void) {
            if (w.code !== 'INEFFECTIVE_DYNAMIC_IMPORT') warn(w as never)
          },
        },
      }
    : {
        chunkSizeWarningLimit: 800,
        // scripts/prerender.mjs reads the manifest to preload the blog's CSS/JS
        manifest: true,
        rollupOptions: {
          output: {
            manualChunks(id: string) {
              if (id.includes('node_modules/three')) return 'three'
              if (id.includes('node_modules/gsap')) return 'gsap'
              // React runtime in its own long-cached chunk (was auto-named after the first shared module)
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
            },
          },
        },
      },
}))
