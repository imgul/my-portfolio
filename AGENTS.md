# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini, etc.) working in this repo.
Humans: start with [README.md](README.md). This file is the short, rule-heavy version.

## Project

Personal site of **Muhammad Gulzaib** (founder & senior full-stack engineer), live at <https://gulzaib.vercel.app>.

- **Portfolio** (`/`): an immersive single page. React 19 + three.js particle scene + GSAP/Lenis scroll + generative audio. All copy lives in `src/data/content.ts`.
- **Blog** ("Gul’s Notebook", `/blog`): reading-first MDX blog, **pre-rendered to static HTML** at build time, then rendered client-side. Separate bundle and styles (`src/blog/`), no 3D.
- **Stack:** Vite 8, React 19, TypeScript, MDX (remark-gfm, remark-math, rehype-katex, Shiki), Supabase (post reactions only), Vercel (static hosting + one function `api/link-preview.js`).
- **Owner details:** X/Twitter **@gulzaib_ai** (used for `twitter:site` / `twitter:creator`), canonical origin `https://gulzaib.vercel.app`.

## Commands

```bash
npm install
npm run dev                     # http://localhost:5173 (binds 0.0.0.0)
npm run build                   # tsc → vite build → SSR build → prerender → link previews
LINK_PREVIEWS=off npm run build # same, but skip fetching external link metadata (offline / sandbox)
npm run preview                 # serve dist/ on :4173
npm run lint:blog               # check posts against docs/BLOG_GUIDELINES.md
npm run seo:check               # audit dist/ (also runs at the end of every build)
```

There is no ESLint/Prettier config and no test suite; **`npm run build` is the check**. It must finish with `seo: … 0 errors` and should finish with `0 warnings`. Before you call a change done:

1. `LINK_PREVIEWS=off npm run build` passes (type-check included).
2. `npm run lint:blog` shows no new warnings if you touched posts.
3. For UI changes: open the preview and look at both the portfolio and a blog post, in light and dark themes, at mobile width.

## Where things live

| Path | What |
|---|---|
| `src/data/content.ts` | All portfolio copy. Edit here, not in components. |
| `src/components/` | Portfolio sections, HUD, loader. **`Hero.tsx` holds the only runtime `<h1>`** on `/`. |
| `src/three/` | Particle scene (`ParticleField.ts`) and shape builders. Loaded lazily, on idle, after `load` (see `src/App.tsx`). |
| `src/blog/posts/*.mdx` | Blog posts. File name = URL slug. |
| `src/blog/components/mdx.tsx` | Every component usable inside posts. |
| `src/blog/blog.css` | Blog themes/typography. Colours must pass WCAG AA in every theme (the footer promises this). |
| `src/blog/scholar.mjs` | Author, ORCID, licences, citation formats. |
| `scripts/blog.mjs` | Frontmatter loader, post lint, feeds, sitemap, robots, llms.txt, all `<head>` tags and JSON-LD. |
| `scripts/prerender.mjs` | Static pages, Markdown copies, PDFs, OG images, feeds. |
| `scripts/og.mjs` | OG image renderers (`/og/*.png?v=<hash>`). |
| `scripts/seo-check.mjs` | Post-build SEO gate. |
| `scripts/link-previews.mjs` | Link preview snapshot (`public/link-previews.json`, `public/link-icons/`). |
| `scripts/portrait.mjs` | Regenerates avatar / icons / favicons from the source photo. |
| `docs/BLOG_GUIDELINES.md` | How posts should read, rank and get cited. |
| `.github/workflows/link-previews.yml` | Refreshes the link preview snapshot and **commits to `main` as a bot**. |

## Rules

### Git

- A GitHub Action commits a snapshot refresh to `main` after merges. **Always `git pull --rebase` (or merge `origin/main`) before pushing**, or the push is rejected.
- Don't commit `dist/`, `.ssr/`, or `node_modules/`.

### SEO / GEO (enforced by `seo:check` and `lint:blog`)

Fix SEO problems **in the generators** (`scripts/blog.mjs`, `scripts/og.mjs`), not in one page, so future posts inherit the fix.

- Title ≤ 70 chars (aim 30–65). Meta description 50–160 (posts: 70–160). `og:title` ≥ 25 chars.
- Exactly **one `<h1>`** per page *outside* `<noscript>` (checkers ignore noscript content).
- Every page has a canonical URL, an OG image, `twitter:site`, and JSON-LD.
- `robots.txt` deliberately welcomes search and AI crawlers; `llms.txt` / `llms-full.txt` and per-post `.md` copies exist for AI agents. Keep them.

### Writing a post

- Add `src/blog/posts/<slug>.mdx` (lowercase-with-hyphens). Frontmatter reference: README → "Blog".
- Start with `<TLDR>` (or `<Abstract>` for research). Answer first, then explain.
- `category` is one of `Founder | Engineering | AI Research | Writing`. 1–8 lowercase tags.
- Descriptive link text (never "click here"), alt text on images, no skipped heading levels, cite sources with `<Cite id="…" />` + `references:`.
- OG image, feeds, sitemap, Markdown/PDF copies and structured data are generated automatically. Don't hand-write them.

### Accessibility (WCAG 2.2 AA)

- Text contrast ≥ 4.5:1 (3:1 for large text) in **every** theme. Category colours from `CATEGORY_COLOR` are too light for small text; mix them with `--text` (≈60%) as `.b-cat` does.
- Links inside sentences must be underlined, not colour-only.
- A control's accessible name must **start with its visible text** (`aria-label="Not really, 3 readers…"` for a button that says "Not really").
- Touch targets ≥ 24×24 px.
- Respect `prefers-reduced-motion`; the portfolio has a silent / reduced mode.

### Performance

- Keep three.js, audio, and other decorative code out of the critical path: dynamic `import()` and start on idle.
- Size images to their display size (`avatar-96.webp` for ≤ 48 px slots, `srcset` for bigger).
- Vendor chunks are split in `vite.config.ts` (`three`, `gsap`, `react`).
- Measure performance on the **live URL with PageSpeed Insights**. Headless Chrome in containers renders WebGL/compositing in software, which adds a ~1 s GPU stall to every page and inflates TBT.

## Agent skills

Skills from [skills.sh](https://skills.sh) are installed in **`.agents/skills/`** (the universal location). `.claude/skills/` symlinks to the same folders. Versions are pinned in `skills-lock.json`.

- **Restore** after cloning, if the folders are missing: `npx skills experimental_install`
- **Find more:** `npx skills find <topic>` or browse skills.sh. **Add:** `npx skills add <owner/repo> -s <skill> -a universal -a claude-code`
- **Update:** `npx skills update`

Read a skill's `SKILL.md` before doing the kind of work it covers.

| When you are… | Use |
|---|---|
| Looking for a skill that isn't installed | `find-skills` |
| Designing or restyling UI, picking palettes/fonts/layouts | `ui-ux-pro-max`, `frontend-design`, `design-system`, `ui-styling`, `brand` |
| Reviewing UI against interface guidelines | `web-design-guidelines` |
| Writing React components, splitting bundles, fixing re-renders | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Running an overall quality pass (perf + a11y + SEO + best practices) | `web-quality-audit`, then the focused skills below |
| Fixing accessibility | `accessibility` |
| Fixing speed, LCP / INP / CLS | `performance`, `core-web-vitals`, `vercel-optimize` |
| Security headers, console errors, deprecated APIs | `best-practices` |
| Technical / on-page SEO | `seo`, `seo-audit`, `site-architecture` |
| Being cited by ChatGPT / Perplexity / AI Overviews (GEO, AEO) | `ai-seo` |
| JSON-LD / structured data | `schema` |
| Generating many similar pages (tags, series, topics) | `programmatic-seo` |
| Full-site crawl audit (needs the squirrel CLI) | `audit-website` |
| Writing or editing site copy, CTAs, headlines | `copywriting`, `copy-editing`, `writing-guidelines` |
| Planning posts, topics, series | `content-strategy`, `customer-research`, `competitor-profiling` |
| Positioning, persuasion, launch, social posts | `product-marketing`, `marketing-psychology`, `launch`, `social` |
| Testing a running page in a browser (Playwright) | `webapp-testing` |
| Reviewing a diff / PR for security regressions | `differential-review`, `sharp-edges` |
| Adding or upgrading npm dependencies | `supply-chain-risk-auditor` |

Notes:
- Marketing skills look for `.agents/product-marketing.md` for positioning context. Create it with the `product-marketing` skill before heavy copy work.
- Some skills ship Python helper scripts (`ui-ux-pro-max/scripts/search.py`, etc.). Run them on demand; they are not part of the build.
- Skills are guidance, not ground truth. Where a skill conflicts with the rules above (e.g. it suggests a different framework), **this file wins**.
