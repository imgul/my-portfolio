import { useEffect } from 'react'
import { lessons } from '../data/content'
import { getPost } from './data'
import { setHead } from './head'
import { Link } from './router'

// The first three lessons are shared with the portfolio. The additional notes
// use the author's existing published stories rather than inventing new ones.
const notes = [
  { ...lessons[0], label: 'VALIDATION', context: 'The POS SaaS', quote: 'Now I validate before I build.' },
  { ...lessons[1], label: 'DISTRIBUTION', context: 'Cold calls to schools', quote: 'Every rejected call is a free lesson in positioning.' },
  { ...lessons[2], label: 'DESIGN', context: 'The school clerk', quote: '“Where do I click to print the fee voucher?”' },
  {
    n: '04', slug: 'the-inclinepos-failure-what-ignoring-offline-requirements-taught-me',
    title: 'Plan for the worst normal day.',
    body: 'InclinePOS failed because I treated continuous internet connectivity as a safe default for a point-of-sale system. The shop still needs to sell when the connection goes down.',
    label: 'RELIABILITY', context: 'InclinePOS', quote: 'Availability is part of the product’s core value proposition.',
  },
  {
    n: '05', slug: 'fee-vouchers-not-dashboards-what-schools-pay-for',
    title: 'Listen for the real problem.',
    body: 'I expected smart timetables near the top. They hardly came up. Fee collection and talking to parents came up on almost every call.',
    label: 'CUSTOMER DISCOVERY', context: 'Oxygen LMS', quote: 'The schools corrected me.',
  },
  {
    n: '06', slug: 'distribution-beats-features-notes-from-cold-calling-schools',
    title: 'Ask about their work.',
    body: 'The first version of my script was a feature list. It failed. The version that worked was short and about their problem.',
    label: 'SALES', context: 'The first calls', quote: 'Asking for advice instead of a sale changes the tone of the whole call.',
  },
]
const count = String(notes.length).padStart(2, '0')
const rangeEnd = String(notes.length).padStart(3, '0')

export default function LessonsPage() {
  useEffect(() => {
    setHead({
      title: 'Lessons that cost me something · Muhammad Gulzaib',
      description: 'Founder lessons on validation, sales and building reliable, simple software for shops and schools.',
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
          <p className="cost-kicker"><span className="cost-dot" /> FIELD NOTES &nbsp; / &nbsp; 001—{rangeEnd}</p>
          <h1>Lessons that <em>cost</em> me something.</h1>
          <p className="cost-intro">A few things I learned building software for shops and schools. The full stories are in the notebook.</p>
          <a className="cost-jump" href="#lessons">Explore the lessons <span aria-hidden="true">↓</span></a>
        </div>
        <div className="cost-hero__art" aria-hidden="true">
          <span className="cost-art__top">THE FOUNDER NOTES <span>✳</span></span>
          <div className="cost-art__mark"><span>{notes.length}</span><i>×</i></div>
          <div className="cost-art__bottom"><span>BUILT IN THE REAL WORLD</span><span>NOTES / 01</span></div>
        </div>
      </header>
      <div className="cost-section-head" id="lessons"><div><p className="cost-kicker">THE COLLECTION</p><h2>What building taught me.</h2></div><span>{count} NOTES <span aria-hidden="true">↘</span></span></div>
      <div className="cost-list">
        {notes.map((lesson) => {
          const post = getPost(lesson.slug)
          return <article className="cost-card" key={lesson.n}>
            <div className="cost-card__number">{lesson.n}<span aria-hidden="true"> / {count}</span></div>
            <div className="cost-card__main"><p className="cost-card__label">{lesson.n} / {lesson.label}</p><h3>{lesson.title}</h3><p className="cost-card__body">{lesson.body}</p>{post && <Link className="cost-card__link" href={`/blog/${lesson.slug}`}>Read the full story <span aria-hidden="true">↗</span></Link>}</div>
            <aside className="cost-card__aside"><span>{lesson.context}</span><p>{lesson.quote}</p></aside>
          </article>
        })}
      </div>
      <div className="cost-end"><div><p className="cost-kicker">KEEP READING</p><h2>More from the notebook.</h2><p>Notes on building companies, shipping software and thinking with AI.</p></div><Link href="/blog">Explore the notebook <span aria-hidden="true">↗</span></Link></div>
    </main>
  )
}
