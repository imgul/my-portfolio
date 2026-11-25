import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/400-italic.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import 'katex/dist/katex.min.css'
import './blog.css'
import { applyPrefs } from './prefs'
import { loadBody } from './content'
import BlogApp from './BlogApp'

applyPrefs()
document.documentElement.style.background = ''

const root = document.getElementById('root')!
const page = root.dataset.ssr // "index" | "post" | "research" | "legal" | "404" when pre-rendered
const notFound = page === '404'

async function start() {
  // Pre-rendered markup can be hydrated only if the URL renders the same thing
  // (filters in ?query change the index, so those render fresh).
  const slug = location.pathname.replace(/\/+$/, '').split('/blog/')[1]
  const canHydrate = page === 'post' ? !!slug : page === 'index' ? !location.search : page === 'research' || page === 'legal' || notFound
  if (page && canHydrate) {
    if (page === 'post' && slug) await loadBody(decodeURIComponent(slug)).catch(() => undefined)
    hydrateRoot(root, <BlogApp notFound={notFound} />, {
      onRecoverableError: (e) => console.warn('[blog] recovered from a hydration mismatch', e),
    })
  } else {
    root.textContent = ''
    createRoot(root).render(<BlogApp notFound={notFound} />)
  }
}
start()
