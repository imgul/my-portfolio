import { lazy, Suspense, useEffect, useRef } from 'react'
import { useLocation } from './router'
import BlogIndex from './BlogIndex'
import PostPage, { NotFound } from './PostPage'
import SeriesPage from './SeriesPage'
import { BackToTop, Footer, Header } from './components/layout'
import { Toaster } from './components/ui'
import { ResearchPage } from './components/scholar'
import LegalPage from './LegalPage'
import LessonsPage from './LessonsPage'
import { legalByPath } from './legal.mjs'
import CookieConsent from '../lib/consent/CookieConsent'
import { useHydrated } from './hydrated'
import { getPrefs, reduceMotion, usePrefs } from './prefs'
import { haptics } from '../lib/haptics'

// hover / tap cards for every link (client only, loaded after the page)
const LinkPreviews = lazy(() => import('../lib/linkPreview/LinkPreviews'))
const previewFeedback = {
  sound: () => getPrefs().sounds === 'on',
  haptic: (p: 'tick' | 'tap' | 'click' | 'success') => {
    if (getPrefs().haptics === 'on') haptics.fire(p)
  },
}

/** `notFound` forces the 404 page (the pre-rendered 404.html, served for unknown URLs). */
export default function BlogApp({ notFound }: { notFound?: boolean }) {
  const { path } = useLocation()
  const slug = path.startsWith('/blog/') ? decodeURIComponent(path.slice('/blog/'.length)) : ''
  // /blog/series/<slug> is a blog collection page; "series" is a static segment,
  // so it takes precedence over the /blog/<post-slug> route below
  const seriesSlug = path.startsWith('/blog/series/') ? decodeURIComponent(path.slice('/blog/series/'.length)) : ''
  const legal = legalByPath(path)
  const first = useRef(true)
  const hydrated = useHydrated()
  const { previews } = usePrefs()

  // after client-side navigation, move focus to the new page (screen readers announce it)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!location.hash) document.getElementById('main')?.focus({ preventScroll: true })
  }, [path])

  return (
    <div className="b-app">
      <Header />
      {notFound ? (
        <NotFound />
      ) : legal ? (
        <LegalPage key={legal.id} id={legal.id} />
      ) : path === '/blog' ? (
        <BlogIndex />
      ) : path === '/blog/lessons' ? (
        <LessonsPage />
      ) : path === '/blog/research' ? (
        <ResearchPage />
      ) : seriesSlug && !seriesSlug.includes('/') ? (
        <SeriesPage key={seriesSlug} slug={seriesSlug} />
      ) : slug && !slug.includes('/') ? (
        <PostPage key={slug} slug={slug} />
      ) : (
        <NotFound />
      )}
      <Footer />
      <BackToTop />
      <Toaster />
      {hydrated && <CookieConsent variant="blog" />}
      {hydrated && previews === 'on' && (
        <Suspense fallback={null}>
          <LinkPreviews theme="blog" feedback={previewFeedback} reducedMotion={reduceMotion} />
        </Suspense>
      )}
    </div>
  )
}
