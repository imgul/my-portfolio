/**
 * npm run blog:dois [-- --dry]
 *
 * After the blog is accepted by Rogue Scholar (rogue-scholar.org), every new
 * open-access post gets a free Crossref DOI within minutes of publishing. This
 * script looks up each open post (by URL) in the Rogue Scholar API and writes
 * the DOI into the post's frontmatter (`doi: 10.59350/…`), so the next build
 * shows it on the page, in citations, the PDF, JSON-LD and the citation_doi tag.
 *
 * Run it on your machine (it needs internet), then commit and push.
 */
import fs from 'node:fs'
import path from 'node:path'
import { loadPosts, POSTS_DIR, SITE_URL } from './blog.mjs'
import { LICENSES } from '../src/blog/scholar.mjs'

const dry = process.argv.includes('--dry')
const API = 'https://rogue-scholar.org/api/records'

async function lookup(url) {
  // InvenioRDM search: the post URL is stored as an identifier (scheme url / guid)
  for (const u of [url, `${url}/`]) {
    const q = `metadata.identifiers.identifier:"${u}"`
    const res = await fetch(`${API}?q=${encodeURIComponent(q)}&size=1`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Rogue Scholar API ${res.status} for ${u}`)
    const hit = (await res.json())?.hits?.hits?.[0]
    const doi = hit?.pids?.doi?.identifier
    if (doi) return { doi, record: hit.links?.self_html }
  }
  return null
}

const posts = loadPosts(POSTS_DIR).filter((p) => LICENSES[p.license].open)
let added = 0
for (const p of posts) {
  const url = `${SITE_URL}/blog/${p.slug}`
  if (p.doi) {
    console.log(`✓ ${p.slug}: ${p.doi}`)
    continue
  }
  try {
    const found = await lookup(url)
    if (!found) {
      console.log(`· ${p.slug}: no DOI yet (is the blog registered with Rogue Scholar, and was the post published > 10 min ago?)`)
      continue
    }
    console.log(`+ ${p.slug}: ${found.doi}  ${found.record ?? ''}`)
    if (!dry) {
      const file = path.join(POSTS_DIR, `${p.slug}.mdx`)
      const src = fs.readFileSync(file, 'utf8')
      // insert after the date line, keeping the rest of the frontmatter untouched
      const next = src.replace(/^(---\r?\n[\s\S]*?^date:.*$)/m, `$1\ndoi: ${found.doi}`)
      if (next === src) throw new Error('could not find the date: line')
      fs.writeFileSync(file, next)
      added++
    }
  } catch (e) {
    console.error(`! ${p.slug}: ${e.message}`)
    process.exitCode = 1
  }
}
console.log(dry ? '\n(dry run, nothing written)' : `\n${added} DOI${added === 1 ? '' : 's'} added. Rebuild, commit and push.`)
