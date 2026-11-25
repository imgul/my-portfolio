/**
 * AI-tell ("slop") checker for prose. Rules come from the installed skills:
 *   .agents/skills/humanizer   (Wikipedia "Signs of AI writing", numbered §1–§26)
 *   .agents/skills/stop-slop   (phrases.md, structures.md)
 *
 * It is a tripwire, not a judge: it finds the patterns a careful human editor would
 * cut, so a person can rewrite them. It does not try to predict "AI detector" scores
 * and nothing here is meant to disguise who wrote a text. The fix for a flag is
 * always the same: say the specific thing, in your own words.
 *
 *   npm run lint:slop                 every post + site copy, with a score per file
 *   npm run lint:slop -- path.mdx     only these files
 *   npm run lint:slop -- --strict     exit 1 if any file scores below 85
 *
 * Quoted examples can opt out with <!-- slop-ignore-start --> … <!-- slop-ignore-end --> (in MDX, put the same markers in JSX comments),
 * and lines marked ❌ are skipped. Deliberately NOT flagged: curly quotes and apostrophes (this site uses typographic
 * punctuation on purpose), technical uses of words like "robust" or "key" (key-value).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** [label, regex, weight]; weight is points off a 100-point score per hit */
const STRONG = [
  // humanizer §1, stop-slop "binary contrasts"
  ['not-X-but-Y contrast', /\b(?:it'?s|it is|this is|that'?s|that is|is|was|are)\s+not\s+(?:just|only|merely|simply|about)\b[^.!?\n]{0,80}?(?:[,;:—–]|\.\s+)\s*(?:it'?s|it is|but|this is|they'?re)\b/gi, 6],
  ['not-X-but-Y contrast', /\b(?:it'?s|this is|that'?s)\s+not\s+(?:an?|the|your)\s+[^.!?\n]{1,40}[.;—–]\s*(?:it'?s|this is|that'?s)\s+(?:an?|the|your)\b/gi, 6],
  ['not-X-but-Y contrast', /\bisn'?t\s+(?:just|only|merely|about)\b[^.!?\n]{0,80}?[,;:.—–]\s*(?:it'?s|it is|but)\b/gi, 6],
  ['not-because-but-because', /\bnot because\b[^.!?\n]{0,80}\bbut because\b/gi, 6],
  // humanizer §22 chatbot residue
  ['chatbot residue', /\b(?:I hope this helps|great question|certainly!|as an AI\b|I'?d be happy to|let me know if you(?:'d| would) like|feel free to reach out)/gi, 10],
  // humanizer §4, stop-slop throat-clearing
  ['throat-clearing opener', /\b(?:here'?s the thing|here'?s why|here'?s what|here'?s how|here'?s the (?:kicker|catch|twist)|the (?:uncomfortable |hard |simple )?truth is|let that sink in|make no mistake|full stop\.|let me be clear|it turns out|the reality is|spoiler:|plot twist:)/gi, 5],
  ['filler phrase', /\b(?:at its core|in today'?s (?:[\w-]+\s+){0,2}(?:world|landscape|age|era|market|economy)|it'?s worth noting|it is worth noting|at the end of the day|in a world where|when it comes to|in the realm of|needless to say|in conclusion)\b/gi, 4],
  // humanizer §13 inflated significance, §16 sales language
  ['inflated significance', /\b(?:(?:stands|serves) as a (?:testament|reminder)|a testament to|pivotal (?:moment|role)|(?:plays?|played) a (?:key|crucial|vital|pivotal|significant) role|evolving landscape|ever-evolving|indelible mark|the future looks bright|exciting times (?:lie )?ahead|game[- ]changer|unlock(?:s|ing)? the (?:power|potential|full)|supercharge|revolutioni[sz]e|paradigm shift|embark on (?:a|this|the) journey)\b/gi, 5],
  ['sales language', /\b(?:seamless(?:ly)?|cutting-edge|best-in-class|world-class|next-level|effortless(?:ly)?|empower(?:s|ing)? (?:you|businesses|teams)|elevate your)\b/gi, 3],
  // humanizer §25 writing about the document
  ['meta commentary', /\b(?:in this (?:post|article|blog|guide|section),? (?:we|I)(?:'ll| will)|let(?:'s| us) (?:dive|delve) (?:in|into)|without further ado|as we(?:'ll| will) see|the rest of this (?:post|essay|article))\b/gi, 4],
]

/** humanizer §12: words models overuse. Weak alone; flagged by density. */
const AI_WORDS =
  /\b(?:delve[sd]?|delving|tapestry|testament|underscor(?:e|es|ed|ing)|showcas(?:e|es|ed|ing)|intricac(?:y|ies)|intricate|meticulous(?:ly)?|garner(?:s|ed)?|bolster(?:s|ed)?|interplay|vibrant|enduring|pivotal|crucial|additionally|furthermore|moreover|realm|multifaceted|nuanced|holistic|synergy|leverag(?:e|es|ed|ing)|utiliz(?:e|es|ed|ing)|foster(?:s|ed|ing)?|streamlin(?:e|es|ed|ing)|navigat(?:e|es|ing) the|landscape)\b/gi

/** Strip frontmatter, code, JSX/HTML tags, URLs and link targets; keep readable prose. */
export function prose(src, { mdx = true } = {}) {
  let s = mdx ? matter(src).content : src
  s = s
    // quoted examples of bad patterns (style guides, before/after demos) can opt out
    .replace(/(?:<!--|\{\/\*)\s*slop-ignore-start[\s\S]*?slop-ignore-end\s*(?:-->|\*\/\})/g, ' ')
    .replace(/^.*❌.*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s*(?:import|export)\s.*$/gm, ' ')
    .replace(/<[^>\n]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, '$1')
  return s
}

const sentencesOf = (text) =>
  text
    .replace(/\n{2,}/g, '. ')
    .split(/(?<=[.!?])\s+(?=[A-Z"“‘(])/)
    .map((x) => x.trim())
    .filter((x) => x.split(/\s+/).length >= 3)

/** Analyse plain prose. Returns { score, words, flags: [{label, text, weight}] }. */
export function analyse(text, { kind = 'prose' } = {}) {
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length
  const flags = []
  for (const [label, re, weight] of STRONG) {
    for (const m of text.matchAll(re)) flags.push({ label, text: m[0].replace(/\s+/g, ' ').slice(0, 90), weight })
  }

  const per1k = (n) => (words ? (n * 1000) / words : 0)

  const aiWords = [...text.matchAll(AI_WORDS)].map((m) => m[0].toLowerCase())
  if (words >= 80 && per1k(aiWords.length) > 4) {
    flags.push({ label: 'AI vocabulary cluster', text: `${aiWords.length} in ${words} words: ${[...new Set(aiWords)].slice(0, 8).join(', ')}`, weight: Math.min(15, Math.round(per1k(aiWords.length) - 2) * 2) })
  }

  // humanizer §8 / stop-slop rule 6: em dashes as the universal connector (budget: 1 per 300 words)
  const dashes = (text.match(/—|\s--\s/g) || []).length
  const budget = Math.max(1, Math.floor(words / 300))
  if (dashes > budget) flags.push({ label: 'em dash overuse', text: `${dashes} em dashes in ${words} words (budget ${budget})`, weight: Math.min(12, (dashes - budget) * 2) })

  // humanizer §6: forced triads ("X, Y and Z") everywhere. Weak alone: factual lists (a stack, a feature set)
  // are fine, so only prose is checked and only a heavy habit is flagged. Site copy is mostly lists by design.
  const triads = (text.match(/\b[\w'-]+(?: [\w'-]+){0,3}, [\w'-]+(?: [\w'-]+){0,3},? (?:and|or) [\w'-]+/g) || []).length
  if (kind === 'prose' && words >= 300 && per1k(triads) > 12) flags.push({ label: 'triad habit (weak alone)', text: `${triads} three-item lists in ${words} words; keep the factual ones, cut rhetorical ones (two items beat three)`, weight: 3 })

  // stop-slop rule 6: metronomic rhythm. Low variation in sentence length reads machine-made.
  const lens = sentencesOf(text).map((x) => x.split(/\s+/).length)
  if (lens.length >= 12) {
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length)
    const cv = sd / mean
    if (cv < 0.38) flags.push({ label: 'flat sentence rhythm', text: `sentence lengths vary by only ${Math.round(cv * 100)}% (aim for 45%+; mix short and long)`, weight: 6 })
  }

  // humanizer §2: one-line punchy closers after many paragraphs
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => /[a-z]/i.test(p) && !/^[-*\d|>]/.test(p))
  const closers = paras.filter((p) => p.split(/\s+/).length <= 6 && /[.!]$/.test(p)).length
  if (paras.length >= 8 && closers / paras.length > 0.2) flags.push({ label: 'one-line closers', text: `${closers} of ${paras.length} paragraphs are dramatic one-liners`, weight: 5 })

  const score = Math.max(0, 100 - flags.reduce((a, f) => a + f.weight, 0))
  return { score, words, flags }
}

/** Long string literals from a TS/JS source file (site copy). */
export function copyStrings(src) {
  const out = []
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const s = m[2]
    if (s.split(/\s+/).length >= 8 && /[a-z]{3,}/.test(s) && !/^(?:https?:|\/|\.\/|[\w-]+\.\w+$)/.test(s)) out.push(s.replace(/\\(['"`])/g, '$1'))
  }
  return out.join('\n\n')
}

export function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const isCode = /\.(t|j)sx?$|\.mjs$/.test(file)
  const isDoc = /README\.md$|AGENTS\.md$|docs\//.test(file)
  const text = isCode ? copyStrings(src) : prose(src, { mdx: /\.mdx?$/.test(file) })
  return { file: path.relative(ROOT, file), ...analyse(text, { kind: isCode || isDoc ? 'copy' : 'prose' }) }
}

export const DEFAULT_TARGETS = () => {
  const posts = path.join(ROOT, 'src/blog/posts')
  return [
    ...fs.readdirSync(posts).filter((f) => f.endsWith('.mdx')).map((f) => path.join(posts, f)),
    path.join(ROOT, 'src/data/content.ts'),
    path.join(ROOT, 'README.md'),
  ]
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const strict = args.includes('--strict')
  const files = args.filter((a) => !a.startsWith('--'))
  const targets = files.length ? files.map((f) => path.resolve(f)) : DEFAULT_TARGETS()
  const results = targets.map(checkFile)
  let worst = 100
  for (const r of results) {
    worst = Math.min(worst, r.score)
    const mark = r.score >= 95 ? '✓' : r.score >= 85 ? '~' : '✗'
    console.log(`${mark} ${String(r.score).padStart(3)}  ${r.file}  (${r.words} words)`)
    for (const f of r.flags) console.log(`        -${f.weight}  ${f.label}: “${f.text}”`)
  }
  const avg = Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
  console.log(`\nslop: ${results.length} files, average ${avg}/100, lowest ${worst}/100 (rules: .agents/skills/humanizer, .agents/skills/stop-slop)`)
  if (strict && worst < 85) process.exit(1)
}
