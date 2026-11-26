# gulzaib.dev: portfolio of Muhammad Gulzaib

A portfolio you can see, hear and feel, built for Muhammad Gulzaib (Gul): Founder & CEO of SynergyFlow Labs and Senior Full Stack Engineer.

## What's inside

| Layer | Tech |
| --- | --- |
| 3D | **Three.js**. A single GPU particle system (up to 20k points) with its own animated shape for every section: galaxy (Intro) → DNA (Manifesto) → winding road with milestones (Journey) → city of boxes (Ventures) → open book with a turning page (Notes) → floating stack layers (Stack) → neural network (Agents) → tree with roots (Learning) → Margalla Hills with a trail and sun (Beyond) → globe with arcs from Islamabad (Contact). Custom GLSL morphs the shapes in a staggered wave and adds per-shape motion, gentle mouse repulsion and scroll turbulence. Each shape sits beside its section's text, and a "reading mode" slows and dims the scene while you read, then wakes it when you scroll. |
| Motion | **GSAP + ScrollTrigger** (pinned manifesto, horizontal journey, stacking venture cards, counters, split-letter reveals) and **Lenis** smooth scroll |
| Sound | **Web Audio API**, fully generative with no audio files. The default **Soundtrack** gives every section its own piece of music matched to its 3D shape (Interstellar-style organ for the galaxy, Bach for Learning, birdsong and a wooden flute for the Margalla Hills…) and crossfades between them as you scroll. Everything stays calm, with no drums or noise beds. Soft UI sounds. |
| Haptics | **Vibration API** on Android, plus the iOS 18+ Safari switch-checkbox haptic trick |
| Interaction | Magnetic buttons, custom cursor, 3D tilt cards, a playable "stack synth", a clickable multi-agent orchestrator with a live terminal, velocity-reactive marquees |
| App | React 19 + TypeScript + Vite |

Press **M** to toggle sound and **N** to switch the music track. The site respects `prefers-reduced-motion`.

### A soundtrack per section

The default track, **Soundtrack** (`src/lib/sound/themes/soundtrack.ts`, instruments in `src/lib/sound/instruments.ts`), gives every section its own piece. Scrolling into a section crossfades to its piece over about 3 seconds, and the "now playing" chip shows the title.

| Section | Shape | Piece | Instruments |
|---|---|---|---|
| Intro | galaxy | **Interstellar** | pipe organ chords, a slow pedal-note ostinato, a soft ticking clock (A minor) |
| Manifesto | DNA | **Conviction** | bowed strings over a pizzicato heartbeat, a violin line swelling in (D minor) |
| Journey | road | **Open Road** | fingerpicked acoustic guitar, Travis-style (G major) |
| Ventures | city | **City Lights** | minimalist marimba cell that shifts against the beat (F lydian) |
| Notes | book | **Pages** | solo felt piano, rolled chords and a rubato melody |
| Stack | layers | **Clockwork** | two kalimbas meshing like gears, 4 against 3 (E minor) |
| Agents | neural net | **Many Minds** | three "agents" (bell, kalimba, piano) looping phrases of different lengths (D dorian) |
| Learning | tree | **Study Hall** | Bach's Prelude in C on piano with a cello pedal, classic study music |
| Beyond | mountains | **Margalla Trail** | nature: birdsong, a breeze, a mountain stream, wooden-flute phrases, a soft drone |
| Contact | globe | **Homecoming** | warm piano arpeggios and strings (D major) |

The keyboard sounds (the playable stack synth, the hold-to-copy charge) follow the key of whatever piece is playing. A rendered tour of all ten pieces is in `sound-previews/tour-soundtrack.mp3`.

**Other tracks.** Press **N** or tap the chip to switch between Soundtrack, Deep Focus (one calm pad and piano piece), Original, A · Neon Pulse, B · Margalla Dawn and C · Night Shift (lo-fi). Those share one score that re-arranges itself per section (`scenes.ts` and `conductor.ts`): layers, key, tone, reverb and ambience change with each section. Audition any track with `/?sound=soundtrack|focus|original|pulse|dawn|lofi`.

## Blog: Gul’s Notebook (`/blog`)

A reading-first blog for founders, engineers, technical writers and AI researchers, kept separate from the portfolio. It has its own small bundle and calm styles, with no 3D, custom cursor or smooth-scroll hijacking. Every page is **pre-rendered to static HTML** at build time, so readers, search engines and AI assistants get the full text without running JavaScript. React then hydrates it.

**Write a post:** add `src/blog/posts/my-slug.mdx`. The file name is the URL (`/blog/my-slug`). Then run `npm run lint:blog`, which checks the post against [`docs/BLOG_GUIDELINES.md`](docs/BLOG_GUIDELINES.md): title and description length, heading order, alt text, broken links, citations and more. `npm run lint:slop` scores it for AI-writing tells (rules from the `humanizer` and `stop-slop` skills; aim for 95+). How posts are drafted from voice notes: [`docs/VOICE.md`](docs/VOICE.md). Current calendar: [`docs/CONTENT_PLAN_DEC_2026.md`](docs/CONTENT_PLAN_DEC_2026.md).

**Schedule a post:** give it a future `date:`. Production builds leave it out entirely (page, feeds, sitemap, JS) until that day in Islamabad time, and the *Publish scheduled posts* workflow redeploys that morning. Preview a date with `PUBLISH_DATE=2026-12-05 npm run build`.

```mdx
---
title: "Post title"              # 30–65 characters
description: "One or two sentences, 70–160 characters. Cards, feeds, search results."
date: 2026-11-24                 # publish day (Asia/Karachi); a future date schedules the post
updated: 2026-12-01              # optional; shown as "Updated" and used as dateModified
category: Founder                # Founder | Engineering | AI Research | Writing
tags: [saas, validation]
series: Founder lessons          # optional; posts in a series link to each other
seriesPart: 4
featured: true                   # optional; shown as "Start here" on the index
draft: true                      # optional; visible in dev only
art: city                        # galaxy | dna | road | city | book | stack | network | tree | mountains | globe
level: Beginner                  # optional: Beginner | Intermediate | Advanced
references:                      # optional; cite with <Cite id="lewis2020" />
  - { id: lewis2020, authors: "Lewis, P. et al.", title: "Retrieval-Augmented Generation…", year: 2020, url: "https://arxiv.org/abs/2005.11401" }
faq:                             # optional; rendered at the end and as FAQPage structured data
  - q: "A question readers actually ask?"
    a: "A short, self-contained answer."
---
```

### Reading experience and accessibility

- **Easy on the eyes:** no pure white or pure black. Five themes: Auto, Light (warm paper), Sepia, Dim (soft charcoal) and Night (very dark, warm amber text with less blue light). Body text is 11–15:1 contrast and secondary text is at least 4.5:1 in every theme (WCAG AA, and AAA for body text). A **High contrast** switch is also available.
- **Reader settings (saved per device):** text size in 5 steps, typeface (Source Serif 4 with optical sizes, Inter, or **Atkinson Hyperlegible** for low-vision and dyslexic readers), line spacing, line length (58/68/80 characters), reduced motion, plus optional quiet focus music. The settings are applied before first paint, so the page never flashes the wrong theme.
- **Keyboard:** skip link, visible focus rings, roving radio groups, and shortcuts (press `?`): `/` search, `j`/`k` next or previous section, `s` save, `f` focus mode, `l` listen, `t` theme, `+`/`−` text size, `g h` blog home.
- **Screen readers:** landmarks, an ordered breadcrumb, one `h1` per page, `aria-pressed` toggles, live-region announcements (search results, votes, toasts), focus moved to the new page after client-side navigation, and labelled code regions and tables. It also respects `prefers-reduced-motion`, forced colours (Windows High Contrast) and print.
- **Features:** reading progress with minutes left, **resume where you left off**, **Continue reading** and **Saved** posts on the index (both stored locally), **Listen** (text-to-speech with a read-along highlight), focus mode, a sticky TOC with scrollspy, wrap and copy on code blocks, a series banner, series progress, **Up next** (previous/next part, with planned parts and dates) and a collapsed series overview, a per-post FAQ, Cite this post (APA/MLA/BibTeX), share (LinkedIn, X, WhatsApp, email, native), the post as Markdown, Suggest an edit, an author card and a newsletter.
- **Index:** weighted search across titles, tags, descriptions and section headings, with match highlighting (press `/`). Also category, tag, series and saved filters, sorting (newest, oldest, quickest, most useful), grid or list view, "Pick your path" by audience, series cards and topics.
- **Series:** a series is an ordered collection inside the blog, defined in `src/blog/series.mjs` (title, description, stages, planned parts, SEO) and joined by posts with `seriesSlug` + `seriesPart` (+ optional `seriesStage`). Series posts keep their canonical `/blog/<slug>` URLs and appear in listings, search, feeds and related posts like any other post; the series landing page lives at `/blog/series/<slug>` (CollectionPage + ItemList structured data, in the sitemap and llms.txt). Planned parts show their title and date without linking to an empty page. The database model is in `supabase/migrations/20261127090000_blog_series.sql`.

### Likes / dislikes (Supabase)

Each post ends with **“Was this post useful?”** (Useful / Not really). After voting, the reader can leave an optional, anonymous note (“What could be better?”). Votes are stored in the free Supabase project **gul-blog** (`okcynutijcqzftegrsci`, region ap-south-1). The schema is in [`supabase/migrations/20261124173500_blog_reactions.sql`](supabase/migrations/20261124173500_blog_reactions.sql):

- Table `post_reactions`: one row per (post, anonymous browser id), with `value` ±1 and an optional `reason` up to 600 characters. RLS is on with no policies, so the public key cannot read or write the table directly.
- The browser can only call two functions: `reaction_counts(slugs[])` and `react(slug, visitor, value, reason)`. Value 0 removes a vote, there is a limit of 60 votes per IP per hour, and only a salted hash of the IP is stored.
- The publishable key and URL are defaults in `src/blog/reactions.ts`, so no env vars are needed. Override them with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, or set either to an empty string to turn shared counts off.

**Read the feedback** in the Supabase dashboard → SQL editor:

```sql
select slug, case value when 1 then 'useful' else 'not useful' end as vote, reason, updated_at
from post_reactions where reason is not null order by updated_at desc;

select * from reaction_summary;   -- likes, dislikes, notes and last vote per post
```

### SEO, GEO and AI-readiness

Built with the build step (`vite build` → SSR build → [`scripts/prerender.mjs`](scripts/prerender.mjs)):

- `blog.html`, `blog/<slug>.html` and `404.html`: full pre-rendered HTML with a unique title and description, canonical URL, Open Graph and Twitter tags, `article:*` metadata and JSON-LD (`BlogPosting` with author `Person`, `BreadcrumbList`, `Blog`/`CollectionPage`, and `FAQPage` when a post has `faq`). The blog's CSS and JS are preloaded.
- `og/<slug>.png` and `og/blog.png`: 1200×630 social images rendered from each post's generative cover with real fonts (resvg).
- `blog/<slug>.md`: a clean Markdown copy of every post, linked from the page with `rel="alternate"` and served with a canonical `Link` header.
- `llms.txt` and `llms-full.txt` ([llmstxt.org](https://llmstxt.org)): a map of the blog, plus the full text, for language models.
- `rss.xml` and `feed.json` with full post content; `sitemap.xml` with `lastmod` and images.
- `robots.txt`: explicitly welcomes search engines and AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others).
- Writing guidance for answer engines (answer-first TL;DR, question-shaped headings, FAQ, citations, an updated date) is in [`docs/BLOG_GUIDELINES.md`](docs/BLOG_GUIDELINES.md).

### Research, citations and indexing

Posts are set up to be cited and indexed like scholarly work. The step-by-step setup for ORCID, Rogue Scholar DOIs, Google Scholar, Zenodo, IEEE, Semantic Scholar and OpenAlex is in [`docs/SCHOLARLY_INDEXING.md`](docs/SCHOLARLY_INDEXING.md).

- **Identity:** [`src/blog/scholar.mjs`](src/blog/scholar.mjs) holds the author (ORCID [0009-0000-8709-6989](https://orcid.org/0009-0000-8709-6989)), the research `PROFILES` (paste a URL and it appears everywhere), the licence rules and the citation formats. The build and the browser share it.
- **Licences:** AI Research, Engineering and Writing posts are **CC BY 4.0**. Founder posts are all rights reserved. Override with `license:` in a post's frontmatter.
- **On open posts:** Highwire Press `citation_*` and Dublin Core tags (Google Scholar, Zotero, Mendeley), `ScholarlyArticle` JSON-LD with ORCID, `rel="license"`, an "Open access" badge, and `rel="cite-as"` plus `citation_doi` once a post has a `doi:`.
- **Every post:** an "Article information" panel (author + ORCID, dates, DOI or permanent link, licence, downloads), "Cite this post" in APA, MLA, Chicago, IEEE, Harvard, BibTeX and RIS (`.bib`/`.ris` downloads), and a **PDF** (`/blog/<slug>.pdf`, generated with pdfkit by [`scripts/pdf.mjs`](scripts/pdf.mjs)).
- **`/blog/research`:** identifiers, open-access posts, how to cite, reuse policy (schema.org `ProfilePage`).
- **`/feeds/open-access.xml`** (Atom) and **`/feeds/open-access.json`:** CC BY posts only, full text, ORCID and licence. Register the Atom feed with [Rogue Scholar](https://rogue-scholar.org) for free Crossref DOIs.
- `npm run blog:dois` writes Rogue Scholar DOIs into post frontmatter. `npm run blog:indexnow` pings Bing and other IndexNow engines after a deploy. Both need internet, so run them on your machine.

Set `VITE_SITE_URL` to change the canonical domain (default `https://gulzaib.vercel.app`). Set `VITE_NEWSLETTER_ENDPOINT` to a URL that accepts `POST {email}` to collect signups; without it, the form falls back to a pre-filled email.

**Components available in every post (no imports):** `TLDR`, `Abstract`, `Takeaways`, `Callout` (note/tip/warning/danger/insight/success), `Update`, `PullQuote`, `Stats`/`Stat`, `Timeline`/`Event`, `Decision` (ADR), `ProsCons`, `Steps`/`Step`, `Tabs`/`Tab`, `FileTree`, `Kbd`, `Cite` with automatic references, `BarChart`, `Flow`, `Sidenote`, `Term`, `Details`, `Figure`, `YouTube`, `LinkCard`, `PostLink`. Markdown extras: GFM tables, task lists and footnotes, KaTeX math (`$…$`, `$$…$$`), and Shiki code blocks with `title="file.ts"`, `showLineNumbers`, `{2-4}` line highlights, and wrap and copy buttons. The post [`how-i-write-technical-posts-a-field-guide-with-examples.mdx`](src/blog/posts/how-i-write-technical-posts-a-field-guide-with-examples.mdx) shows every component in use.

## Link previews (every link, portfolio and blog)

Hover a link (mouse, pen or keyboard focus) to see a card: favicon, title, description, image and details. On touch, the first tap shows the card (a bottom sheet on phones, swipe down to close) and a second tap or **Open** follows the link.

- **Data:** `scripts/link-previews.mjs` runs after the build and writes `dist/link-previews.json` plus the favicons (`dist/link-icons/`). It covers this site's pages, posts, PDFs and feeds, and every external link in `src/` and the built HTML. Results are cached in `node_modules/.cache/gul-link-previews` (set `LINK_PREVIEWS=off` to skip fetching). `GITHUB_TOKEN` is optional; it raises GitHub's API limit.
- **Snapshot:** `data/link-previews.snapshot.json` holds the real titles, descriptions, images, paper metadata (arXiv API, Crossref) and favicons of every external link. The **Link previews** GitHub Actions workflow (`.github/workflows/link-previews.yml`) refetches it every Monday, when the fetcher changes, or on demand (Actions → Link previews → Run workflow), and commits it only if something changed. The build uses it whenever a live fetch fails or runs offline. Its `failing` list shows the links that can't be fetched right now and why. Sites that can't be reached at all get the hand-written fallbacks in `FALLBACKS` (`scripts/link-previews.mjs`).
- **Any link, live:** links the build missed (new posts, links added at runtime) are fetched at `/api/link-preview?url=…`, a Vercel function that shares its code with the build (`scripts/link-meta.mjs`; `vite dev` and `vite preview` serve the same endpoint). What it understands:
  - **APIs first:** GitHub repos, profiles, issues and PRs; DOIs (Crossref); arXiv; Wikipedia; npm; PyPI; and oEmbed for YouTube, Vimeo, X, Spotify, SoundCloud, TikTok, Reddit, CodePen, Loom, Figma and any page that advertises oEmbed.
  - **Pages:** Open Graph, Twitter cards, `citation_*` tags, JSON-LD (articles, products with price and rating, videos with duration, events), the page's own charset, `<meta http-equiv="refresh">` redirects, and the first heading and paragraph when a page has no meta tags at all.
  - **Files:** images (with dimensions), video, audio, PDFs, archives, feeds and text files get a file card with type and size, using `Content-Disposition` for the name and reading only the first 64 KB.
  - **Blocked or flaky sites:** one retry with a browser-like user agent (403, 429, 5xx, resets).
  - **Safety and cost:** same-origin only, SSRF-safe (every hop's IP is checked), byte and time limits, 30 requests then one every 2 s per IP, tracking parameters stripped so caches are shared.
- **Caching, outermost first:** the build manifest (`/link-previews.json`); the browser (`localStorage`: fresh for 1 day, served stale while it refreshes for 14 days, failures for 20 minutes, 160 links max, shared between tabs); Vercel's edge (`s-maxage` 7 days + `stale-while-revalidate` 30 days, failures 15 minutes); the function's own LRU with in-flight dedupe; and ETags (`304 Not Modified`).
- **Loading:** a hover or a finger on a link starts the fetch before the card opens (hover intent), and its images are warmed. Links that stay on screen are prefetched while the browser is idle (`IntersectionObserver` + `requestIdleCallback`, at most 16 a page, never on Save-Data or 2G). Requests go through a queue (3 at a time, hovers jump ahead of prefetches, one retry with backoff honouring `Retry-After`, 12 s timeout). Cards show a shimmer and a progress bar until data arrives; images load lazily, decode off the main thread and fade in.
- **Fallbacks:** if nothing can be fetched the card is built from the URL itself (brand name, colour, favicon, readable title such as "vitejs/vite · Issue #1") with a quiet note saying why (offline, or no details). A stale copy beats nothing.
- **In-page links:** `#section` links show the section's title, first paragraph and reading time; citation links (`[1]`) show the cited work's own card, labelled "Reference 1". Tables of contents, skip links and heading anchors are left alone.
- **Client:** `src/lib/linkPreview/` (one delegated listener; mounted in `src/App.tsx` and `src/blog/BlogApp.tsx`). `data-no-preview` turns the card off for a link or a container. `data-preview="hover"` keeps the hover card but lets a tap open the link straight away (used for the blog header, breadcrumbs, prev/next and link cards).
- **Feedback:** soft synthesized sounds (follow the portfolio's sound toggle; on the blog, Settings → Sounds, off by default) and haptics on phones (blog: Settings → Vibration). Reduced motion turns the motion into fades. Blog readers can turn previews off in Settings.

## SEO and share images

Every page gets its own `<head>` and its own 1200×630 share image. Nothing has to be added by hand: a new post (or a change to the portfolio copy) gets them on the next build.

| Page | `<head>` | Share image |
| --- | --- | --- |
| `/` portfolio | generated from `src/data/content.ts` and injected into `dist/index.html`: title, description, canonical, Open Graph `profile`, Twitter, `rel="me"`, JSON-LD (`WebSite` + search, `ProfilePage`, `Person`, one `Organization` per venture), plus a summary inside `#root` with the page's one `<h1>` for crawlers that don't run JavaScript (visually hidden while the app boots, shown as a plain page when JavaScript is off; React replaces it on mount) | `og/home.png`: photo on the lime disc, role, tagline, stack, ventures, latest note |
| `/blog` | `Blog` + `ItemList` JSON-LD, RSS/JSON Feed links | `og/blog.png`: post count, categories, latest post |
| `/blog/<slug>` | title, description, canonical, `article:*`, Twitter reading time and category, `citation_*` (Google Scholar), `BlogPosting` + `BreadcrumbList` (+ `FAQPage`) JSON-LD | `og/<slug>.png`: category colour and cover art, series, reading time, date, level or licence |
| `/blog/research` | `ProfilePage` + `Person` with ORCID | `og/research.png`: open-access posts and citation formats |
| `/blog/series/<slug>` | `CollectionPage` + `ItemList` + `BreadcrumbList` JSON-LD | `og/series-<slug>.png`: series title, subtitle, published/planned counts |
| 404 | `noindex` | `og/404.png` |

- **Code:** images are drawn by `scripts/og.mjs` (SVG → PNG with resvg, fonts from `@expo-google-fonts`); head tags and JSON-LD come from `scripts/blog.mjs` (`headTags`, `homeHeadTags`); `scripts/prerender.mjs` renders them after the build. Image URLs carry a content hash (`?v=…`) so LinkedIn, X, Slack and WhatsApp refetch an image when it changes.
- **Between pages:** the blog is a single-page app after the first load, so `src/blog/head.ts` updates the title, description, canonical, robots and share tags on every navigation. Filtered blog views (`?tag=`, `?category=`) get their own title; search results and saved posts are `noindex`.
- **X:** `twitter:site` and `twitter:creator` come from `AUTHOR.x` in `src/blog/scholar.mjs` (`gulzaib_ai`), which also feeds `sameAs`, the author card and the share button's `via`.
- **Titles:** a post's `<title>` is "Post title · Gul’s Notebook" when that fits in about 65 characters, otherwise just the post title. Set `seoTitle:` in the frontmatter to choose a shorter one.
- **Audit:** the build ends with `scripts/seo-check.mjs`, which reads every page in `dist/` and **fails the build** on a missing title, description, canonical, Open Graph or Twitter tag, a share image that doesn't exist, invalid JSON-LD, a link to another host, a sitemap URL without a page, or a duplicate title or description. Warnings: titles over 70 characters, descriptions over 160 (Google cuts them off), share titles under 25, no `twitter:site`, missing alt text, and anything but exactly one `<h1>` (`<noscript>` doesn't count). Run it on its own with `npm run seo:check`.
- **Domain:** URLs use `VITE_SITE_URL` (default `https://gulzaib.vercel.app`). Set it in Vercel if the site moves to a custom domain.

## Portrait, logo and icons

One photo (`assets/gulzaib.jpg`) feeds every image of me on the site. `scripts/portrait.mjs` cuts out the background and writes each version into `public/img/gul/`, plus the favicons and app icons in `public/`:

| File | Where | Look |
| --- | --- | --- |
| `hero-bw.webp` / `hero-color.webp` | Portfolio hero, the pill next to GULZAIB | black and white cut-out on lime; colour on hover |
| `mark.webp` | Portfolio logo (top left) | face on ink inside the spinning lime ring; colour on hover |
| `avatar.webp` | Blog header mark, bylines, author card, research page | warm-toned transparent cut-out (the reader's theme shows through) |
| `avatar-og.png` | Blog post share images (`og/<slug>.png`) | same, embedded by `scripts/prerender.mjs` |
| `assets/og-person.png` | Portfolio share image (`og/home.png`, drawn by `scripts/og.mjs`) | black and white cut-out, placed on a lime disc |
| `gulzaib.jpg` | `Person.image` structured data, link-preview cards | the original photo |
| `/favicon.svg`, `/favicon-32.png`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, `/site.webmanifest` | Browser tabs, home screens | face in a lime-to-blue ring on ink |

The outputs are committed, so the normal build doesn't need the image tools. To change the photo, replace `assets/gulzaib.jpg` and run:

```bash
npm i --prefix /tmp/imgtools sharp @imgly/background-removal-node
PORTRAIT_TOOLS=/tmp/imgtools node scripts/portrait.mjs
```

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check, build, pre-render the blog into dist/
npm run lint:blog  # check posts against docs/BLOG_GUIDELINES.md
npm run seo:check  # audit dist/ (titles, descriptions, OG images, JSON-LD); also runs in build
npm run blog:dois  # fetch Rogue Scholar DOIs into post frontmatter (after registering the blog)
npm run blog:indexnow  # tell Bing & co. that pages changed (after a deploy)
npm run preview
```

## Edit content

All copy (experience, ventures, skills, certifications, agents and so on) lives in
[`src/data/content.ts`](src/data/content.ts). Edit that file and you don't need to touch any component.

## Structure

```
src/
  data/content.ts         all portfolio content
  three/ParticleField.ts  morphing particle scene (GLSL, per-shape motion + framing)
  three/shapes.ts         point-cloud builders, one per section
  lib/audio.ts            generative music + SFX engine
  lib/haptics.ts          vibration / iOS haptics
  lib/scroll.ts           Lenis + ScrollTrigger wiring
  components/             one file per section + HUD, cursor, loader
  main.tsx                entry: loads the blog for /blog*, the portfolio otherwise
  blog/
    posts/*.mdx           blog posts (frontmatter + MDX)
    BlogIndex.tsx         /blog: search, filters, paths, continue reading, saved, series
    PostPage.tsx          /blog/:slug: TOC, progress/resume, actions, FAQ, reactions, cite
    scholar.mjs           author/ORCID, research profiles, licences, citation formats, Scholar meta tags
    components/scholar.tsx  ORCID iD, article info, Cite this post, /blog/research page
    components/mdx.tsx    every component available inside posts
    components/reactions.tsx  "Was this useful?" + optional feedback (Supabase)
    components/listen.tsx text-to-speech read-along
    prefs.ts / store.ts   reader settings / saved posts, progress, votes (localStorage)
    reactions.ts          Supabase RPC client (counts, votes)
    ssr.tsx               server renderer used by the pre-render step
    blog.css              reading-first themes and typography
scripts/blog.mjs          frontmatter loader, lint, feeds, sitemap, robots, llms.txt, head tags/JSON-LD
scripts/prerender.mjs     static pages, Markdown copies, PDFs, OG images, feeds (runs after vite build)
scripts/pdf.mjs           PDF version of each post (pdfkit)
scripts/blog-dois.mjs     npm run blog:dois (Rogue Scholar DOI lookup)
scripts/indexnow.mjs      npm run blog:indexnow
supabase/migrations/      likes/dislikes schema
docs/BLOG_GUIDELINES.md   how to write posts that read well, rank and get cited
docs/SCHOLARLY_INDEXING.md  free setup: ORCID, Rogue Scholar DOIs, Google Scholar, Zenodo, IEEE…
```

## Working with AI agents

[`AGENTS.md`](AGENTS.md) holds the rules and commands for coding agents (`CLAUDE.md` imports it). Skills from [skills.sh](https://skills.sh) (UI/UX, accessibility, performance, SEO/GEO, copywriting, marketing, security) are installed in `.agents/skills/` and pinned in `skills-lock.json`. Restore them with `npx skills experimental_install`. `AGENTS.md` maps each skill to the work it covers.

## Deploy

It's a static Vite app. On Vercel, import the repo and it auto-detects Vite (build `npm run build`, output `dist`). `vercel.json` turns on clean URLs (so `blog/<slug>.html` is served at `/blog/<slug>`) and sets content types for feeds, Markdown and `llms.txt` (PDFs get a canonical `Link` header pointing to the HTML post). Unknown URLs get the pre-rendered `404.html` with a real 404 status.
