/**
 * npm run blog:indexnow [-- url1 url2 …]
 *
 * Tells Bing (which also powers ChatGPT search and Copilot), Yandex, Seznam and
 * Naver that pages changed, so they're re-crawled within minutes instead of
 * days. Free, no account: the key file /<INDEXNOW_KEY>.txt is published by the
 * build. Without arguments it submits the blog index, the research page and
 * every post. Run after a deploy (it needs internet).
 */
import { INDEXNOW_KEY, SITE_URL, loadPosts, postUrl } from './blog.mjs'

const args = process.argv.slice(2).filter((a) => a.startsWith('http'))
const urls = args.length ? args : [`${SITE_URL}/blog`, `${SITE_URL}/blog/research`, ...loadPosts().map(postUrl)]
const host = new URL(SITE_URL).host
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls }),
})
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urls.length} URL${urls.length === 1 ? '' : 's'}`)
if (res.status >= 400) {
  console.log(await res.text())
  process.exitCode = 1
}
