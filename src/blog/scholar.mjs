/**
 * Scholarly identity, licences and citations for Gul's Notebook.
 *
 * Plain JS with no Node imports, shared by the build (scripts/blog.mjs,
 * scripts/prerender.mjs, scripts/pdf.mjs) and the browser (PostPage, CiteThis,
 * AuthorCard), so the <head> tags, the "Cite this post" box, the PDFs and the
 * feeds always say exactly the same thing.
 *
 * ▶ To add a research profile: paste its URL into PROFILES below. Empty URLs are
 *   hidden everywhere; filled ones appear in the author card, the research page,
 *   JSON-LD `sameAs` (which links your identities for Google and AI assistants)
 *   and llms.txt. See docs/SCHOLARLY_INDEXING.md for the free sign-up steps.
 */

export const ORCID = '0009-0000-8709-6989'

export const AUTHOR = {
  name: 'Muhammad Gulzaib',
  givenName: 'Muhammad',
  familyName: 'Gulzaib',
  /** "Family, Given" as used by citation managers and Google Scholar */
  citationName: 'Gulzaib, Muhammad',
  email: 'iigulzaib@gmail.com',
  jobTitle: 'Founder & CEO, SynergyFlow Labs · Senior Full Stack Engineer',
  affiliation: 'SynergyFlow Labs',
  location: 'Islamabad, Pakistan',
  orcid: ORCID,
  orcidUrl: `https://orcid.org/${ORCID}`,
  /** X (Twitter) handle: twitter:site / twitter:creator and the share button */
  x: 'gulzaib_ai',
  knowsAbout: ['SaaS', 'Laravel', 'React', 'Retrieval-augmented generation', 'AI agents', 'Product validation', 'Technical writing'],
}

/**
 * Research and professional profiles. Order = display order.
 * `research: true` profiles are shown under "Research profiles".
 */
export const PROFILES = [
  { id: 'orcid', label: 'ORCID', url: AUTHOR.orcidUrl, research: true },
  { id: 'google-scholar', label: 'Google Scholar', url: '', research: true },
  { id: 'semantic-scholar', label: 'Semantic Scholar', url: '', research: true },
  { id: 'rogue-scholar', label: 'Rogue Scholar', url: '', research: true },
  { id: 'zenodo', label: 'Zenodo', url: '', research: true },
  { id: 'openalex', label: 'OpenAlex', url: '', research: true },
  { id: 'ieee-collabratec', label: 'IEEE Collabratec', url: '', research: true },
  { id: 'techrxiv', label: 'TechRxiv', url: '', research: true },
  { id: 'researchgate', label: 'ResearchGate', url: '', research: true },
  { id: 'academia', label: 'Academia.edu', url: '', research: true },
  { id: 'osf', label: 'OSF', url: '', research: true },
  { id: 'wikidata', label: 'Wikidata', url: '', research: true },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/gulzaib-ai', research: false },
  { id: 'github', label: 'GitHub', url: 'https://github.com/imgul', research: false },
  { id: 'x', label: 'X', url: `https://x.com/${AUTHOR.x}`, research: false },
]

/** Profiles with a URL. */
export const activeProfiles = (research) => PROFILES.filter((p) => p.url && (research === undefined || p.research === research))

/** Every identity URL, for JSON-LD sameAs and rel="me". */
export const sameAs = () => activeProfiles().map((p) => p.url)

/* --------------------------------------------------------------- licences */

export const LICENSES = {
  'CC-BY-4.0': {
    id: 'CC-BY-4.0',
    short: 'CC BY 4.0',
    name: 'Creative Commons Attribution 4.0 International',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    open: true,
    summary: 'You may share and adapt this text for any purpose, including commercially, as long as you credit the author and link to the original.',
  },
  'all-rights-reserved': {
    id: 'all-rights-reserved',
    short: 'All rights reserved',
    name: 'All rights reserved',
    url: '',
    open: false,
    summary: 'Quote short passages with a link and credit; please ask before republishing the full text.',
  },
}

/** Research, engineering and writing posts are open access by default; founder essays are not. */
export const OPEN_CATEGORIES = ['AI Research', 'Engineering', 'Writing']

export function licenseFor(category, override) {
  if (override && LICENSES[override]) return override
  return OPEN_CATEGORIES.includes(category) ? 'CC-BY-4.0' : 'all-rights-reserved'
}

export const DOI_RE = /^10\.\d{4,9}\/\S+$/
export const doiUrl = (doi) => `https://doi.org/${doi}`
export const BLOG_NAME = 'Gul’s Notebook'

/* ------------------------------------------------------------- citations */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const parts = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, month: MONTHS[m - 1], mon: MONTHS[m - 1].slice(0, 3) }
}
const bibEsc = (s) => String(s).replace(/([&%$#_])/g, '\\$1').replace(/’/g, "'")
const ieeeMon = (m) => (m.length <= 4 ? m : m.slice(0, 3) + '.').replace('Sep.', 'Sept.')

export const citeKey = (p) => `gulzaib${p.date.slice(0, 4)}${p.slug.split('-').filter((w) => w.length > 2).slice(0, 2).join('')}`

/** All supported citation formats, in display order. */
export const CITE_FORMATS = [
  { id: 'apa', label: 'APA' },
  { id: 'mla', label: 'MLA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'harvard', label: 'Harvard' },
  { id: 'bibtex', label: 'BibTeX', file: 'bib', mime: 'application/x-bibtex' },
  { id: 'ris', label: 'RIS', file: 'ris', mime: 'application/x-research-info-systems' },
]

/**
 * A ready-to-paste citation. `p` needs slug, title, description, date, tags and
 * optionally doi; `site` is the absolute site URL.
 */
export function citation(p, fmt, site) {
  const url = `${site}/blog/${p.slug}`
  const link = p.doi ? doiUrl(p.doi) : url
  const { y, d, month, mon } = parts(p.date)
  switch (fmt) {
    case 'apa':
      return `Gulzaib, M. (${y}, ${month} ${d}). ${p.title}. ${BLOG_NAME}. ${link}`
    case 'mla':
      return `Gulzaib, Muhammad. “${p.title}.” ${BLOG_NAME}, ${d} ${month.length > 4 ? mon + '.' : month} ${y}, ${link.replace(/^https?:\/\//, '')}.`.replace('Sep.', 'Sept.')
    case 'chicago':
      return `Gulzaib, Muhammad. “${p.title}.” ${BLOG_NAME} (blog), ${month} ${d}, ${y}. ${link}.`
    case 'ieee':
      return `M. Gulzaib, “${p.title},” ${BLOG_NAME}, ${ieeeMon(month)} ${d}, ${y}. [Online]. Available: ${url}${p.doi ? `, doi: ${p.doi}.` : ''}`
    case 'harvard':
      return `Gulzaib, M. (${y}) ‘${p.title}’, ${BLOG_NAME}, ${d} ${month}. Available at: ${link}.`
    case 'bibtex':
      return [
        `@misc{${citeKey(p)},`,
        `  author       = {Gulzaib, Muhammad},`,
        `  title        = {{${bibEsc(p.title)}}},`,
        `  howpublished = {${bibEsc(BLOG_NAME)}},`,
        `  year         = {${y}},`,
        `  month        = {${mon.toLowerCase()}},`,
        `  date         = {${p.date}},`,
        p.doi ? `  doi          = {${p.doi}},` : '',
        `  url          = {${url}},`,
        `  langid       = {english},`,
        p.tags?.length ? `  keywords     = {${bibEsc(p.tags.join(', '))}},` : '',
        `}`,
      ]
        .filter(Boolean)
        .join('\n')
    case 'ris':
      return [
        'TY  - BLOG',
        `AU  - ${AUTHOR.citationName}`,
        `TI  - ${p.title}`,
        `T2  - ${BLOG_NAME}`,
        `PY  - ${y}`,
        `DA  - ${p.date.replace(/-/g, '/')}`,
        `UR  - ${url}`,
        p.doi ? `DO  - ${p.doi}` : '',
        `AB  - ${p.description}`,
        ...(p.tags ?? []).map((t) => `KW  - ${t}`),
        'LA  - en',
        'ER  - ',
      ]
        .filter(Boolean)
        .join('\n')
    default:
      return url
  }
}

/* -------------------------------------------------- Google Scholar & Co. */

const metaSafe = (s) => String(s).replace(/;/g, ',')

/**
 * Bibliographic <meta> tags as [name, content] pairs: Highwire Press (citation_*),
 * read by Google Scholar, Zotero, Mendeley and Semantic Scholar, plus Dublin Core
 * (DC.*), read by BASE, CORE and library tools. Only emitted for open (scholarly)
 * posts so Scholar's index isn't diluted by founder essays.
 */
export function citationMeta(p, site, { pdf = true } = {}) {
  const lic = LICENSES[p.license] ?? LICENSES['all-rights-reserved']
  if (!lic.open) return []
  const url = `${site}/blog/${p.slug}`
  const date = p.date.replace(/-/g, '/')
  const m = [
    ['citation_title', p.title],
    ['citation_author', AUTHOR.citationName],
    ['citation_author_orcid', AUTHOR.orcidUrl],
    ['citation_author_institution', AUTHOR.affiliation],
    ['citation_publication_date', date],
    ['citation_online_date', date],
    ['citation_publisher', BLOG_NAME],
    ['citation_language', 'en'],
    ['citation_abstract', p.description],
    ['citation_keywords', p.tags.join('; ')],
    ['citation_abstract_html_url', url],
    ['citation_fulltext_html_url', url],
    pdf ? ['citation_pdf_url', `${url}.pdf`] : null,
    p.doi ? ['citation_doi', p.doi] : null,
    ...(p.references ?? []).map((r) => [
      'citation_reference',
      [
        `citation_title=${metaSafe(r.title)}`,
        r.authors ? `citation_author=${metaSafe(r.authors)}` : '',
        r.year ? `citation_publication_date=${r.year}` : '',
        r.venue ? `citation_journal_title=${metaSafe(r.venue)}` : '',
        r.doi ? `citation_doi=${r.doi}` : '',
        !r.doi && r.url ? `citation_fulltext_html_url=${r.url}` : '',
      ]
        .filter(Boolean)
        .join('; '),
    ]),
    ['DC.title', p.title],
    ['DC.creator', AUTHOR.citationName],
    ['DC.date', p.date],
    ['DC.issued', p.date],
    p.updated ? ['DC.modified', p.updated] : null,
    ['DC.publisher', BLOG_NAME],
    ['DC.type', 'Text'],
    ['DC.format', 'text/html'],
    ['DC.language', 'en'],
    ['DC.description', p.description],
    ...p.tags.map((t) => ['DC.subject', t]),
    ['DC.identifier', p.doi ? doiUrl(p.doi) : url],
    ['DC.rights', `${lic.name} (${lic.url})`],
  ]
  return m.filter(Boolean)
}
