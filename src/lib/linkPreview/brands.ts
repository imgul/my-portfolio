/**
 * Names and colours for well-known sites, used when a page couldn't be
 * fetched (and to tint the monogram). Keys match the host or any parent domain.
 */
export const BRANDS: Record<string, { name: string; color?: string; about?: string }> = {
  'github.com': {
    name: 'GitHub',
    color: '#24292f',
    about: 'Code hosting and collaboration.',
  },
  'gist.github.com': { name: 'GitHub Gist', color: '#24292f' },
  'linkedin.com': {
    name: 'LinkedIn',
    color: '#0a66c2',
    about: 'Professional network.',
  },
  'x.com': { name: 'X', color: '#0f1419' },
  'twitter.com': { name: 'X (Twitter)', color: '#0f1419' },
  'wa.me': { name: 'WhatsApp', color: '#25d366' },
  'whatsapp.com': { name: 'WhatsApp', color: '#25d366' },
  'orcid.org': {
    name: 'ORCID',
    color: '#a6ce39',
    about: 'Persistent identifiers for researchers.',
  },
  'doi.org': {
    name: 'DOI',
    color: '#fcb425',
    about: 'A persistent link to a published work.',
  },
  'arxiv.org': {
    name: 'arXiv',
    color: '#b31b1b',
    about: 'Open-access preprints in physics, maths and computer science.',
  },
  'wikipedia.org': {
    name: 'Wikipedia',
    color: '#636466',
    about: 'The free encyclopedia.',
  },
  'youtube.com': { name: 'YouTube', color: '#ff0033' },
  'youtu.be': { name: 'YouTube', color: '#ff0033' },
  'creativecommons.org': {
    name: 'Creative Commons',
    color: '#ef9421',
    about: 'Free licences for sharing creative work.',
  },
  'anthropic.com': {
    name: 'Anthropic',
    color: '#d97757',
    about: 'AI safety and research company.',
  },
  'openai.com': { name: 'OpenAI', color: '#10a37f' },
  'laravel.com': {
    name: 'Laravel',
    color: '#ff2d20',
    about: 'The PHP framework for web artisans.',
  },
  'react.dev': { name: 'React', color: '#087ea4' },
  'vercel.com': { name: 'Vercel', color: '#000000' },
  'developer.mozilla.org': { name: 'MDN Web Docs', color: '#1b1b1b' },
  'stackoverflow.com': { name: 'Stack Overflow', color: '#f48024' },
  'medium.com': { name: 'Medium', color: '#000000' },
  'npmjs.com': { name: 'npm', color: '#cb3837' },
  'scholar.google.com': { name: 'Google Scholar', color: '#4285f4' },
  'zenodo.org': { name: 'Zenodo', color: '#1682d4' },
  'ieee.org': { name: 'IEEE', color: '#00629b' },
  'techrxiv.org': { name: 'TechRxiv', color: '#00629b' },
  'semanticscholar.org': { name: 'Semantic Scholar', color: '#1857b6' },
  'openalex.org': { name: 'OpenAlex', color: '#c9372c' },
  'researchgate.net': { name: 'ResearchGate', color: '#00ccbb' },
  'rogue-scholar.org': { name: 'Rogue Scholar', color: '#d33f49' },
  'diataxis.fr': {
    name: 'Diátaxis',
    about: 'A systematic approach to technical documentation.',
  },
  'vu.edu.pk': {
    name: 'Virtual University of Pakistan',
    color: '#1d4f91',
    about: 'Public university, Pakistan.',
  },
  'gulzaib.dev': { name: 'Gulzaib', color: '#c6ff3d' },
}
