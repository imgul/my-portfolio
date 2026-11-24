/**
 * Entry point. The portfolio (3D, GSAP, sound) and the blog (calm, reading-first)
 * are separate bundles: /blog/* loads only the blog, everything else the portfolio.
 */
if (window.location.pathname.startsWith('/blog')) import('./blog/main')
else import('./portfolio')
