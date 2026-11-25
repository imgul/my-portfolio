/**
 * node scripts/due-posts.mjs
 *
 * Lists scheduled posts that are due (date <= today in PUBLISH_TZ) but not live yet, by
 * comparing against the live sitemap. Used by .github/workflows/publish-scheduled.yml,
 * which triggers a production deploy only when this finds something, so a missed cron
 * run catches up the next morning. Writes `slugs`, `urls` and `count` to $GITHUB_OUTPUT.
 *
 * If the sitemap can't be fetched it falls back to "dated today", so it never
 * redeploys for old posts by mistake.
 */
import fs from 'node:fs'
import { loadPosts, POSTS_DIR, SITE_URL, postUrl, todayISO } from './blog.mjs'

const today = todayISO()
const published = loadPosts(POSTS_DIR) // drafts and future posts already filtered out

let sitemap = null
try {
  const res = await fetch(`${SITE_URL}/sitemap.xml`, { headers: { 'cache-control': 'no-cache' } })
  if (res.ok) sitemap = await res.text()
} catch {
  /* offline: fall back to today's date */
}

const due = published.filter((p) => (sitemap ? !sitemap.includes(`<loc>${postUrl(p)}</loc>`) : p.date === today))

console.log(`today (${today}): ${due.length} post${due.length === 1 ? '' : 's'} due${sitemap ? '' : ' (sitemap unavailable, checked today only)'}`)
for (const p of due) console.log(`  ${p.date}  ${p.slug}`)

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `count=${due.length}\nslugs=${due.map((p) => p.slug).join(' ')}\nurls=${due.map(postUrl).join(' ')}\n`,
  )
}
