# Featured images ("covers")

Every post gets a 1200×630 featured image. The same image shows up on the blog cards, in the post header, in `<PostLink>` cards, in the older/newer links at the bottom of a post, and as the post's Open Graph image (with a small brand pill), so a share on X, LinkedIn or WhatsApp shows exactly what the blog shows.

Covers are **rendered from the front matter**, not drawn by hand. You describe the cover in a `cover:` block and `scripts/covers.mjs` turns it into an image using the site's own fonts (Inter, Source Serif 4, JetBrains Mono). If the title or numbers change, the cover changes with them.

```
npm run covers          # render changed covers + public/covers/_sheet.webp (all covers on one page)
node scripts/covers.mjs # render changed covers only (runs automatically before `dev` and `build`)
```

Output: `public/covers/<slug>.webp` (1200 wide) and `<slug>-640.webp`, plus `manifest.json` (a content hash per cover; it skips unchanged covers and is added as `?v=` to image URLs so browsers never show an old cover). Both are committed. `_sheet.webp` is git-ignored.

## What a good cover does

People decide in about a second, usually on a phone, with the cover at 350 px wide. A cover has one job: make the title worth reading. So:

1. **One idea, readable at thumbnail size.** At most 8–10 words of large text. If you need a paragraph, it belongs in the description.
2. **Specific beats pretty.** A real number, a real quote, real code or real test output from the post. A generic stock picture says nothing about the post.
3. **Don't repeat the title word for word.** The card already prints the title under the image. The cover should give a second, different reason to click: the number, the conflict or the proof.
4. **Everything on it must be true and in the post.** Anything shown on the cover should appear in the post. No made-up numbers or quotes.
5. **Category colour as the accent** (`CATEGORY_COLOR` in `src/blog/data.ts`) so the blog reads as one family. Override with `accent:` only when there's a reason.
6. **Write a real `alt`.** Describe what's on the image and repeat its words. Cards use an empty alt (the title sits next to the image); the post header and the OG image use yours.

## The ten styles

Each existing post uses a different style so the strongest ones can be picked and reused. Copy the block from the listed post and change the words.

| Style | Strategy | Use when the post has… | Example post |
|---|---|---|---|
| `number` | One big, true number and what it meant | a result or a cost you can count | `code-is-not-a-business-what-20-paying-customers-taught-me` |
| `versus` | What people expect vs what actually wins | a contrarian claim ("X, not Y") | `fee-vouchers-not-dashboards-what-schools-pay-for` |
| `code` | The key code from the post in an editor window, one line lit | one snippet that *is* the answer | `shipping-ai-features-in-laravel-without-blocking-your-app` |
| `image` | An illustration (`assets/covers/<slug>.png`) plus a hook | a concept that's easier to show than say | `multi-tenant-laravel-saas-the-architecture-i-actually-use`, `grounded-exam-generation-with-rag-retrieval-and-evaluation` |
| `headline` | A huge typographic claim on a bold colour | a short, punchy opinion | `distribution-beats-features-notes-from-cold-calling-schools` |
| `quote` | The one line people remember | a real quote from a user or customer | `simple-wins-designing-for-the-least-technical-user-in-the-room` |
| `face` | The author's photo beside a two-line hook | an opinion or a lesson tied to you | `agents-that-do-real-work-a-pragmatic-multi-agent-design` |
| `list` | "N steps" with the steps visible | a checklist or a process | `how-i-write-technical-posts-a-field-guide-with-examples` |
| `mockup` | The thing the post teaches you to make | a template or an artifact | `write-a-readme-people-actually-read` |
| `terminal` | Proof: real test or command output | something you tested or measured | `designing-the-database-for-a-school-erp` |

### Fields

All styles: `style`, `alt` (required), `kicker` (small caps line at the top, e.g. "Engineering · Laravel SaaS"), `accent` (hex, optional).

- `number`: `big` ("~20"), `lines` (1–2 short lines; the last is in the accent colour), `sub`.
- `versus`: `left.label` (the loser, struck out), `right.label`, `right.heading`, `right.rows` (`[label, value]` pairs), `right.totalLabel`, `right.total`, `sub`.
- `code`: `hook` (one line), `file`, `badge`, `highlight` (line numbers), `code` (≤ 12 lines, ≤ 75 characters wide). `->` and `=>` are drawn as typed, never as ligature arrows.
- `image`: `hook` or `hookLines`, `sub`, `subMono`, `subColor`, `kickerColor`, `tint` (gradient colour behind the text), `textWidth` (default 540), `file` (default `<slug>.png`), `position`, `inset` (e.g. `0.82` to shrink a square-ish picture into the right side with faded edges).
- `headline`: `lines` of `{ text, size, y, serif, color, strike, max }`, `sub`.
- `quote`: `quote`, `by`.
- `face`: `lines` (two lines; the second in the accent colour), `sub`. Uses `assets/og-person.png`.
- `list`: `big` (the count), `hook`, `items` (≤ 7, short).
- `mockup`: `hook`, `repo`, `sections` (≤ 4), `badges` (optional `[key, value, colour]`).
- `terminal`: `hook` (one line), `title`, `command`, `lines` (start passing lines with `✓`), `result`.

Text is measured with the real fonts and wrapped or shrunk to fit. If a one-line hook can't fit even at the smallest size, `covers.mjs` prints a warning and cuts it. Shorten the text instead of ignoring the warning.

### Illustrations for the `image` style

Save the source as `assets/covers/<slug>.png` (at least 1200×630, or square-ish with `inset`). Keep the left ~45 % calm and dark (the hook sits there) and the subject on the right. Ask for no text in the picture. `npm run lint:blog` fails if the file is missing.

## Adding a cover to a new post

1. Pick the style that matches what the post *has* (table above). Prefer a number, a quote, code or proof over a picture.
2. Add the `cover:` block right after `category:` in the front matter.
3. `npm run covers`, then open `public/covers/<slug>.webp` and check it at full size and at 350 px wide. Nothing touches an edge, nothing overlaps, and it's readable on a phone.
4. `npm run lint:blog` (a missing `cover:` is a warning; an unknown style, a missing `alt` or a missing image file is an error).
