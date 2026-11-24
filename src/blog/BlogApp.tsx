import { useEffect, useRef } from 'react'
import { useLocation } from './router'
import BlogIndex from './BlogIndex'
import PostPage, { NotFound } from './PostPage'
import { BackToTop, Footer, Header } from './components/layout'
import { Toaster } from './components/ui'

/** `notFound` forces the 404 page (the pre-rendered 404.html, served for unknown URLs). */
export default function BlogApp({ notFound }: { notFound?: boolean }) {
  const { path } = useLocation()
  const slug = path.startsWith('/blog/') ? decodeURIComponent(path.slice('/blog/'.length)) : ''
  const first = useRef(true)

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
      {notFound ? <NotFound /> : path === '/blog' ? <BlogIndex /> : slug && !slug.includes('/') ? <PostPage key={slug} slug={slug} /> : <NotFound />}
      <Footer />
      <BackToTop />
      <Toaster />
    </div>
  )
}
