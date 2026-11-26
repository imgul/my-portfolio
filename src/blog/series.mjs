/**
 * The blog series registry: the "database" for series (blog_series +
 * blog_series_stages in supabase/migrations/20261127090000_blog_series.sql).
 *
 * Posts live as MDX files (src/blog/posts/*.mdx); a post joins a series with
 * frontmatter:
 *
 *   seriesSlug:  distribution-before-product-market-fit   (the key, must match `slug` below)
 *   seriesPart:  3                                        (the part number, unique per series)
 *   seriesStage: Choosing a Market Worth Reaching         (optional; must match a stage title)
 *
 * The legacy `series: <name>` field still works: the loader resolves it to a
 * slug and then to the title here, so the registry is the single source of
 * truth for series names, stages and planned parts.
 *
 * A series page lives at /blog/series/<slug>. Series posts keep their
 * canonical /blog/<post-slug> URLs; the series is an organizational layer
 * inside the blog, not a separate section of the site.
 *
 * Shared by the browser bundle (src/blog/data.ts) and the build scripts
 * (scripts/blog.mjs, scripts/prerender.mjs), so it must stay free of Node
 * APIs. Types live in ./series.d.mts.
 */

/** Mirrors the CHECK constraint on blog_series.status. Only 'published' is public. */
export const SERIES_STATUSES = ['draft', 'scheduled', 'published', 'archived']

export const SERIES = [
  {
    slug: 'distribution-before-product-market-fit',
    title: 'Distribution Before Product-Market Fit',
    subtitle: 'A 15-part field guide for technical founders',
    description: 'A practical field guide for technical founders who can build products but have not yet built a repeatable path to customers.',
    introduction:
      'Most technical founders can build. Fewer can say who the product is for, how those people hear about it, and how to learn from them fast enough to survive. This series is the field guide I wish I had before building: fifteen articles in five stages, from reframing what distribution means to finding a channel that works twice.\n\nIt is written for founders who can ship but have not yet built a repeatable path to customers. Each article ends with one practical action, and the parts build on each other, so reading in order matters.\n\nThe first nine parts are available now. Remaining parts are planned and will link here as they are published.',
    plannedPostCount: 15,
    status: 'published',
    cadence: 'More parts planned',
    seoTitle: 'Distribution Before Product-Market Fit: a field guide',
    seoDescription: '15 articles in 5 stages: how technical founders find a market worth reaching, create customer conversations and turn interest into commercial evidence.',
    stages: [
      { title: 'Reframing Distribution', description: 'Why distribution is a learning system, not a growth hack, and what changes when you treat it that way.', position: 1 },
      { title: 'Choosing a Market Worth Reaching', description: 'How to pick a narrow initial market with real pain, budget and a way to reach it.', position: 2 },
      { title: 'Creating Customer Conversations', description: 'How to start conversations with the people who feel the problem, and what to listen for in them.', position: 3 },
      { title: 'Turning Interest Into Commercial Evidence', description: 'How to turn polite interest into commitments: pilots, pre-payments and signed intent.', position: 4 },
      { title: 'Finding Repeatability', description: 'How to tell whether a channel works twice, and what to do when it does not.', position: 5 },
    ],
    plannedPosts: [
      { position: 1, title: 'Why Technical Founders Struggle With Distribution', stage: 'Reframing Distribution', scheduledDate: '2026-07-04' },
      { position: 2, title: 'Distribution Before Product-Market Fit Is a Learning System', stage: 'Reframing Distribution', scheduledDate: '2026-07-11' },
      { position: 3, title: 'How to Choose a Beachhead Market for Your Product', stage: 'Choosing a Market Worth Reaching', scheduledDate: '2026-07-18' },
      { position: 4, title: 'How to Build an Ideal Customer Profile Before You Have Customers', stage: 'Choosing a Market Worth Reaching', scheduledDate: '2026-07-25' },
      { position: 5, title: 'Customer Discovery That Produces Evidence, Not Compliments', stage: 'Creating Customer Conversations', scheduledDate: '2026-08-01' },
      { position: 6, title: 'Founder-Led Sales Before You Are Ready to Hire Salespeople', stage: 'Turning Interest Into Commercial Evidence', scheduledDate: '2026-08-08' },
      { position: 7, title: 'Outbound Outreach for Technical Founders Who Hate Cold Selling', stage: 'Creating Customer Conversations', scheduledDate: '2026-08-15' },
      { position: 8, title: 'Using Content as a Founder-Led Distribution Channel', stage: 'Creating Customer Conversations', scheduledDate: '2026-08-22' },
      { position: 9, title: 'Communities as Research, Trust, and Distribution Channels', stage: 'Creating Customer Conversations', scheduledDate: '2026-08-29' },
      { position: 10, title: 'Partnerships That Create Real Distribution', stage: 'Creating Customer Conversations' },
    ],
  },
  {
    slug: 'founder-lessons',
    title: 'Founder lessons',
    subtitle: 'What building and selling software taught me',
    description: 'Lessons from building and selling software: validation, distribution and designing for the least technical user.',
    introduction:
      'Three lessons from building and selling software, in the order I learned them: validating the problem before writing code, selling to schools by phone, and designing for the least technical user in the room. Each part stands alone, but together they trace one arc: from code to customers.',
    plannedPostCount: 3,
    status: 'published',
    cadence: 'Complete',
    seoTitle: 'Founder lessons: validation, sales and design',
    seoDescription: 'Three founder lessons in order: validating a SaaS idea before coding, selling software to schools by phone, and designing for the least technical user.',
    stages: [],
    plannedPosts: [],
  },
]

/** "Founder lessons" -> "founder-lessons" (same rule as post slugs). */
export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const seriesBySlug = (slug) => SERIES.find((s) => s.slug === slug)

/** Series that are public (draft / scheduled / archived stay out of every page). */
export const publishedSeries = () => SERIES.filter((s) => s.status === 'published')

/** The series landing page URL. Posts keep their canonical /blog/<slug> URLs. */
export const seriesUrl = (s) => `/blog/series/${s.slug}`

/** Open Graph image key for a series (/og/series-<slug>.png). */
export const seriesOgKey = (s) => `series-${s.slug}`
