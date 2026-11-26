import { useEffect } from 'react'
import { lessons } from '../data/content'
import { getPost } from './data'
import { setHead } from './head'
import { Link } from './router'

const details = [
  { label: '01 / VALIDATION', context: 'The POS SaaS', quote: 'Now I validate before I build.' },
  { label: '02 / DISTRIBUTION', context: 'Cold calls to schools', quote: 'Every rejected call is a free lesson in positioning.' },
  { label: '03 / DESIGN', context: 'The school clerk', quote: '“Where do I click to print the fee voucher?”' },
]

export default function LessonsPage() {
  useEffect(() => {
    setHead({
      title: 'Lessons that cost me something · Muhammad Gulzaib',
      description: 'Three founder lessons on validation, distribution and simple software, learned while building products for shops and schools.',
      path: '/blog/lessons',
      image: 'lessons',
      imageAlt: 'Lessons that cost me something: founder notes by Muhammad Gulzaib',
    })
  }, [])

  return (
    <main id="main" className="cost-page" tabIndex={-1}>
      <nav className="cost-breadcrumb" aria-label="Breadcrumb"><a href="/">Portfolio</a><span aria-hidden="true"> / </span><span aria-current="page">Founder notes</span></nav>
      <header className="cost-hero">
        <div className="cost-hero__copy">
          <p className="cost-kicker"><span className="cost-dot" /> FIELD NOTES &nbsp; / &nbsp; 001—003</p>
          <h1>Lessons that <em>cost</em> me something.</h1>
          <p className="cost-intro">A few things I learned building software for shops and schools. The full stories are in the notebook.</p>
          <a className="cost-jump" href="#lessons">Explore the lessons <span aria-hidden="true">↓</span></a>
        </div>
        <div className="cost-hero__art" aria-hidden="true">
          <span className="cost-art__top">THE FOUNDER NOTES <span>✳</span></span>
          <div className="cost-art__mark"><span>3</span><i>×</i></div>
          <div className="cost-art__bottom"><span>BUILT IN THE REAL WORLD</span><span>NOTES / 01</span></div>
        </div>
      </header>
      <div className="cost-section-head" id="lessons"><div><p className="cost-kicker">THE COLLECTION</p><h2>What building taught me.</h2></div><span>03 NOTES <span aria-hidden="true">↘</span></span></div>
      <div className="cost-list">
        {lessons.map((lesson, i) => {
          const detail = details[i]
          const post = getPost(lesson.slug)
          return <article className="cost-card" key={lesson.n}>
            <div className="cost-card__number">{lesson.n}<span aria-hidden="true"> / 03</span></div>
            <div className="cost-card__main"><p className="cost-card__label">{detail.label}</p><h3>{lesson.title}</h3><p className="cost-card__body">{lesson.body}</p>{post && <Link className="cost-card__link" href={`/blog/${lesson.slug}`}>Read the full story <span aria-hidden="true">↗</span></Link>}</div>
            <aside className="cost-card__aside"><span>{detail.context}</span><p>{detail.quote}</p></aside>
          </article>
        })}
      </div>
      <div className="cost-end"><div><p className="cost-kicker">KEEP READING</p><h2>More from the notebook.</h2><p>Notes on building companies, shipping software and thinking with AI.</p></div><Link href="/blog">Explore the notebook <span aria-hidden="true">↗</span></Link></div>
    </main>
  )
}
