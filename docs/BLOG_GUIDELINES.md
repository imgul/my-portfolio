# Blog guidelines: posts that read well, rank and get cited

How to write a post for Gul’s Notebook that is pleasant to read for a long time, accessible to everyone, and easy for search engines and AI assistants to understand and quote. `npm run lint:blog` checks most of the items marked ✅ automatically.

## 1. Before you write

- **One post, one idea.** Write the idea as one sentence first. If it takes two, you have two posts.
- **Pick the reader.** Each category is one audience: Founder (founders), Engineering (engineers), AI Research (researchers), Writing (technical writers). Write for that person's next decision.
- **Bring something first-hand.** Your numbers, your mistakes, your code and screenshots. First-hand experience is what readers, Google (E-E-A-T) and AI answer engines value most, because it can't be found anywhere else.
- **Talk it before you type it.** Record yourself explaining the post, then build it from the transcript (see [VOICE.md](VOICE.md)). Your own sentences are what keep a post from sounding machine-written.

## 2. Frontmatter

| Field | Rule |
| --- | --- |
| `title` ✅ | 30–65 characters. Specific and plain: say what the reader gets. Put the main keyword near the start. No clickbait. |
| `description` ✅ | 70–160 characters, unique per post. It is the search snippet and the social preview text, so write it as a promise the post keeps. |
| `date` / `updated` ✅ | ISO dates. `date` is the day the post goes public (Islamabad time); a future date schedules it and the site publishes it that morning. Never backdate. When you materially change a post, set `updated`: it shows on the page and becomes `dateModified`. Don't touch it for typo fixes. |
| `category` / `art` ✅ | One of the allowed values. |
| `tags` ✅ | 1–8 lowercase tags. Reuse existing tags before inventing new ones. |
| `faq` | Optional. 2–4 real questions readers ask, each answered in 1–3 self-contained sentences. Rendered at the end and emitted as `FAQPage` structured data. |
| `references` ✅ | Every reference must be cited with `<Cite id="…" />`, and every citation must have a reference. Add `doi:` whenever the cited work has one (✅ format checked): Crossref and Rogue Scholar only track linked references. |
| `license` ✅ | Optional. Defaults to `CC-BY-4.0` for AI Research, Engineering and Writing and `all-rights-reserved` for Founder. Open posts get Google Scholar tags, the open-access feed and free DOIs ([SCHOLARLY_INDEXING.md](SCHOLARLY_INDEXING.md)). |
| `doi` ✅ | Optional. Filled in by `npm run blog:dois` after Rogue Scholar registers the post. Don't invent one. |

The file name is the URL: use the full visible title in lowercase, drop apostrophes, replace other runs of non-alphanumeric characters with hyphens, and trim leading and trailing hyphens (`multi-tenant-laravel-saas-the-architecture-i-actually-use.mdx`). ✅

Avoid renaming a published post. If a slug really has to change, do all four in the same PR: `git mv` the post and its covers, add 301 redirects for `/blog/<old>`, `/blog/<old>.md`, `/blog/<old>.pdf` and `/og/<old>.png` to `vercel.json`, update every `<PostLink>` and `src/data/content.ts`, and add a Supabase migration that moves `post_reactions` rows to the new slug (apply it at deploy). Never rename a post that has a `doi`.

## 3. Structure (answer first)

1. **Start with `<TLDR>`** (or `<Abstract>` for research). ✅ Give the answer in 2–3 sentences. Readers decide in seconds whether to stay, and search and AI engines often quote exactly this paragraph.
2. **Use `##` sections, then `###`.** ✅ Never skip levels, and never use `#` in the body (the title is the only `h1`). Write headings as the question or claim the section answers ("When I'd choose a database per tenant", not "Considerations"). Headings become the table of contents and deep links.
3. **One idea per paragraph, 2–4 sentences.** Front-load each paragraph's point in its first sentence.
4. **End with `<Takeaways>`**: 3–5 bullets someone could act on today.
5. **Link generously.** Link to related posts (`<PostLink slug="…" />` or a Markdown link) ✅ and to primary sources. Use descriptive link text, never "click here" ✅.

## 4. Writing for answer engines (GEO / AIEO)

AI assistants (ChatGPT, Claude, Perplexity, Google AI Overviews) cite pages that are clear, specific and self-contained:

- **Make claims quotable.** Each key sentence should make sense on its own, without "as mentioned above".
- **Be concrete.** Numbers, versions, dates, names, thresholds ("about 20 shops", "k = 60", "Laravel 11"). Vague claims are not cited.
- **Define terms once,** in plain words (`<Term def="…">RAG</Term>`).
- **Cite sources** for anything that isn't your own experience (`references` + `<Cite />`).
- **Use tables and lists for comparisons**, since they extract cleanly.
- **Add an FAQ** with the questions people actually type or ask.
- **Keep it fresh.** Revisit evergreen posts, fix what changed, and set `updated`.

The build already handles the technical side: pre-rendered HTML, JSON-LD (`BlogPosting`, `Person`, `BreadcrumbList`, `FAQPage`), a canonical URL, OG images, sitemap, RSS/JSON feeds with full text, a Markdown copy of every post, `llms.txt` / `llms-full.txt`, and a `robots.txt` that welcomes AI crawlers.

## 5. Accessibility

- **Alt text on every image** ✅ that describes what the image shows and why it matters. Use `alt=""` only for purely decorative images, and put long explanations in the caption.
- **Don't rely on colour alone.** Charts and callouts need labels or icons too.
- **Code:** use real text, never screenshots of code. Add `title="file.ts"`, and keep lines under about 80 characters where you can.
- **Tables:** give every column a header, and keep tables small. Split big ones.
- **Video:** use `<YouTube>` (privacy-friendly, click to load) with a descriptive `title`, and summarise the video in text.
- **Plain language:** short sentences, common words, active voice. Expand acronyms on first use.
- **Link text** must make sense out of context ✅ (screen-reader users often navigate by links).

## 6. Length and reading time

- Aim for 800–2,000 words for deep dives and 400–800 for notes. Posts under 300 words are flagged ✅.
- Reading time is computed automatically (230 wpm plus extra time for code).
- A long post needs more sections, not longer ones ✅.

## 7. Before you publish

- [ ] `npm run lint:blog` passes with no errors (fix warnings or have a reason not to)
- [ ] `npm run lint:slop -- src/blog/posts/<slug>.mdx` scores 95 or more (no AI-writing tells)
- [ ] TL;DR answers the title's question
- [ ] Every claim you didn't experience yourself has a source
- [ ] Read it aloud once (the **Listen** button helps)
- [ ] Check the post in Light and Night themes, and at the largest text size
- [ ] Remove `draft: true` and set `date:` to the publish day, then `npm run build` and check `dist/og/<slug>.png` and `dist/blog/<slug>.pdf`
- [ ] After deploying: `npm run blog:indexnow`; about 15 minutes later `npm run blog:dois` (open posts), then commit and push
