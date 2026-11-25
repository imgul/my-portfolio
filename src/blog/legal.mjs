// The site's legal pages (served at the root, rendered by the blog bundle).
// Shared by the browser (src/blog/LegalPage.tsx, head.ts) and the build (scripts/blog.mjs, prerender).
// Change `updated` whenever the wording changes in substance.

export const LEGAL_UPDATED = '2026-11-25'

export const LEGAL = [
  {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy',
    description: 'What gulzaib.vercel.app collects, how local suggestions work, where data goes and how to delete it. No ads or analytics.',
  },
  {
    id: 'terms',
    path: '/terms',
    title: 'Terms & Conditions',
    description: 'The rules for using Muhammad Gulzaib’s portfolio and blog: who owns the writing, how you can reuse it and the code samples, and what I can’t promise.',
  },
  {
    id: 'cookies',
    path: '/cookies',
    title: 'Cookie Policy',
    description: 'This site sets no cookies. Here is every item it saves in your browser instead, what each one is for, and how to refuse or clear them.',
  },
]

export const LEGAL_PATHS = LEGAL.map((p) => p.path)
export const legalByPath = (path) => LEGAL.find((p) => p.path === path)
