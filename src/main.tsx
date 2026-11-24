/**
 * Entry point. The portfolio (3D, GSAP, sound) and the blog (calm, reading-first)
 * are separate bundles: /blog/* (and the pre-rendered 404 page) loads only the
 * blog, everything else the portfolio.
 */
const ssr = document.getElementById('root')?.dataset.ssr
if (window.location.pathname.startsWith('/blog') || ssr === '404') import('./blog/main')
else import('./portfolio')
