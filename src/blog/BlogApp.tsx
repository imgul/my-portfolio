import { useLocation } from './router'
import BlogIndex from './BlogIndex'
import PostPage, { NotFound } from './PostPage'
import { BackToTop, Footer, Header } from './components/layout'
import { Toaster } from './components/ui'

export default function BlogApp() {
  const { path } = useLocation()
  const slug = path.startsWith('/blog/') ? decodeURIComponent(path.slice('/blog/'.length)) : ''
  return (
    <div className="b-app">
      <Header />
      {path === '/blog' ? <BlogIndex /> : slug && !slug.includes('/') ? <PostPage key={slug} slug={slug} /> : <NotFound />}
      <Footer />
      <BackToTop />
      <Toaster />
    </div>
  )
}
