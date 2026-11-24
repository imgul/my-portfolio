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

A reading-first blog for founders, engineers, technical writers and AI researchers, kept separate from the portfolio. It has its own small bundle and calm styles, with no 3D, custom cursor or smooth-scroll hijacking.

**Write a post:** add `src/blog/posts/my-slug.mdx`. The file name is the URL (`/blog/my-slug`).

```mdx
---
title: "Post title"
description: "One or two sentences. Used on cards, in feeds and in search results."
date: 2026-11-24
updated: 2026-12-01          # optional
category: Founder            # Founder | Engineering | AI Research | Writing
tags: [saas, validation]
series: Founder lessons      # optional; posts in a series link to each other
seriesPart: 4
featured: true               # optional; shown as "Start here" on the index
draft: true                  # optional; visible in dev only
art: city                    # galaxy | dna | road | city | book | stack | network | tree | mountains | globe
level: Beginner              # optional: Beginner | Intermediate | Advanced
references:                  # optional; cite with <Cite id="lewis2020" />
  - { id: lewis2020, authors: "Lewis, P. et al.", title: "Retrieval-Augmented Generation…", year: 2020, url: "https://arxiv.org/abs/2005.11401" }
---
```

**Reading experience:** serif body at about 66 characters per line and 1.7 line height. Light, sepia, dark and auto themes, four text sizes, serif or sans, and comfortable or wide width, all saved per visitor. Optional quiet focus music comes from the portfolio soundtrack. Also: a reading progress bar with minutes left, a sticky table of contents with scrollspy, heading anchor links, series navigation, related posts, previous/next, share and copy link, "Cite this post" (BibTeX/APA), "Suggest an edit" on GitHub, an author card and a newsletter signup. The index has search (press `/`), category and tag filters, a featured post, series, posts grouped by year and topics.

**Components available in every post (no imports):** `TLDR`, `Abstract`, `Takeaways`, `Callout` (note/tip/warning/danger/insight/success), `Update`, `PullQuote`, `Stats`/`Stat`, `Timeline`/`Event`, `Decision` (ADR), `ProsCons`, `Steps`/`Step`, `Tabs`/`Tab`, `FileTree`, `Kbd`, `Cite` with automatic references, `BarChart`, `Flow`, `Sidenote`, `Term`, `Details`, `Figure`, `YouTube`, `LinkCard`, `PostLink`. Markdown extras: GFM tables, task lists and footnotes, KaTeX math (`$…$`, `$$…$$`), and Shiki code blocks with `title="file.ts"`, `showLineNumbers`, `{2-4}` line highlights and a copy button. The post [`how-i-write-technical-posts.mdx`](src/blog/posts/how-i-write-technical-posts.mdx) shows every component in use.

**At build time** the blog writes `rss.xml`, `feed.json`, `sitemap.xml`, `robots.txt` and a pre-rendered HTML shell per post with its own title, description, Open Graph tags and JSON-LD, so links preview properly when shared. Set `VITE_SITE_URL` to change the canonical domain (default `https://gulzaib.vercel.app`). Set `VITE_NEWSLETTER_ENDPOINT` to a URL that accepts `POST {email}` to collect signups; without it, the form falls back to a pre-filled email.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
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
    BlogIndex.tsx         /blog: search, filters, featured, series, archive
    PostPage.tsx          /blog/:slug: TOC, progress, series, share, cite, related
    components/mdx.tsx    every component available inside posts
    blog.css              reading-first themes and typography
scripts/blog.mjs          frontmatter loader, reading time, RSS/JSON feed, sitemap, per-post HTML
```

## Deploy

It's a static Vite app. On Vercel, import the repo and it auto-detects Vite (build `npm run build`, output `dist`). `vercel.json` sends any unknown `/blog/*` route to the app, so it can show its 404 page.
