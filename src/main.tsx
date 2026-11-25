/**
 * Entry point. The portfolio (3D, GSAP, sound) and the blog (calm, reading-first)
 * are separate bundles: /blog/*, the legal pages (/privacy, /terms, /cookies)
 * and the pre-rendered 404 page load only the blog, everything else the portfolio.
 */
import { LEGAL_PATHS } from './blog/legal.mjs'

const ssr = document.getElementById('root')?.dataset.ssr
const path = window.location.pathname.replace(/\/+$/, '')
if (path.startsWith('/blog') || LEGAL_PATHS.includes(path) || ssr === '404') import('./blog/main')
else import('./portfolio')
