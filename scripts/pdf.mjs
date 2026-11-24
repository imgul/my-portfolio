/**
 * PDF version of a post (dist/blog/<slug>.pdf), generated at build time from the
 * post's clean Markdown copy. Used for:
 *   - readers who want to save or print a post;
 *   - Google Scholar (linked via the citation_pdf_url meta tag; Scholar likes a
 *     PDF whose first page carries the title, author and abstract);
 *   - uploading to Zenodo / OSF / TechRxiv / ResearchGate, which archive a file.
 *
 * Page 1: blog name + category, title (24 pt), author + ORCID iD, affiliation,
 * dates, URL/DOI, licence, abstract and keywords. Every page: running header,
 * "Cite as" footer and page numbers. Pure JS (pdfkit), so it runs on Vercel.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import PDFDocument from 'pdfkit'
import * as fontkit from 'fontkit'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { math } from 'micromark-extension-math'
import { mathFromMarkdown } from 'mdast-util-math'
import { AUTHOR, BLOG_NAME, LICENSES, citation, doiUrl } from '../src/blog/scholar.mjs'

const require = createRequire(import.meta.url)
const fontFile = (pkg, dir) => {
  const base = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), dir)
  return path.join(base, fs.readdirSync(base).find((f) => f.endsWith('.ttf')))
}
const FONTS = {
  serif: fontFile('@expo-google-fonts/source-serif-4', '400Regular'),
  serifIt: fontFile('@expo-google-fonts/source-serif-4', '400Regular_Italic'),
  serifSemi: fontFile('@expo-google-fonts/source-serif-4', '600SemiBold'),
  serifBold: fontFile('@expo-google-fonts/source-serif-4', '700Bold'),
  serifBoldIt: fontFile('@expo-google-fonts/source-serif-4', '700Bold_Italic'),
  sans: fontFile('@expo-google-fonts/inter', '400Regular'),
  sansSemi: fontFile('@expo-google-fonts/inter', '600SemiBold'),
  mono: fontFile('@expo-google-fonts/jetbrains-mono', '400Regular'),
}
// glyph coverage, to fall back for symbols a font doesn't have (→, ✓, ≈ …)
const KIT = Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, fontkit.openSync(f)]))
const FALLBACK = ['sans', 'mono', 'serif']

const C = { text: '#25231f', text2: '#4a463f', muted: '#686358', line: '#d9d3c6', soft: '#f3f0e8', link: '#2c58b8', box: '#f7f4ec' }
const A4 = { w: 595.28, h: 841.89 }
const M = { top: 66, bottom: 74, left: 66, right: 66 }
const W = A4.w - M.left - M.right
const BODY = 10.6
// code must show what you type: no programming ligatures (-> must not become →)
const NOLIG = { liga: false, calt: false, dlig: false }

/* ---------------------------------------------------------------- inline */

/** Flatten inline mdast into styled runs. */
function runs(nodes, style = {}) {
  const out = []
  for (const n of nodes ?? []) {
    switch (n.type) {
      case 'text':
        out.push({ text: n.value.replace(/\s*\n\s*/g, ' '), ...style })
        break
      case 'emphasis':
        out.push(...runs(n.children, { ...style, italic: true }))
        break
      case 'strong':
        out.push(...runs(n.children, { ...style, bold: true }))
        break
      case 'delete':
        out.push(...runs(n.children, { ...style, strike: true }))
        break
      case 'inlineCode':
        out.push({ text: n.value, ...style, code: true })
        break
      case 'inlineMath':
        out.push({ text: n.value, ...style, code: true })
        break
      case 'link':
        // in-page anchors (#ref-…) mean nothing in a PDF; keep the text, drop the link
        out.push(...runs(n.children, n.url.startsWith('#') ? style : { ...style, link: n.url }))
        break
      case 'image':
        out.push({ text: `[Figure: ${n.alt || 'image'}]`, ...style, italic: true })
        break
      case 'break':
        out.push({ text: '\n', ...style })
        break
      case 'html':
        break
      default:
        if (n.children) out.push(...runs(n.children, style))
        else if (n.value) out.push({ text: n.value, ...style })
    }
  }
  return out
}
const plain = (nodes) => runs(nodes).map((r) => r.text).join('')

function fontKey(r, base) {
  if (r.code) return 'mono'
  if (base === 'sans') return r.bold ? 'sansSemi' : 'sans'
  if (r.bold && r.italic) return 'serifBoldIt'
  if (r.bold) return base === 'serifSemi' ? 'serifBold' : 'serifSemi'
  if (r.italic) return 'serifIt'
  return base
}

/** Split a run where its font lacks glyphs, falling back to a font that has them. */
function glyphSafe(text, key) {
  const parts = []
  let cur = { key, text: '' }
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    let k = key
    if (cp > 0x7e && !/\s/.test(ch) && !KIT[key].hasGlyphForCodePoint(cp)) k = FALLBACK.find((f) => KIT[f].hasGlyphForCodePoint(cp)) ?? null
    if (k === null) continue // no font has it (emoji): drop rather than print a box
    if (k !== cur.key) {
      if (cur.text) parts.push(cur)
      cur = { key: k, text: '' }
    }
    cur.text += ch
  }
  if (cur.text) parts.push(cur)
  return parts
}

/* ---------------------------------------------------------------- render */

export function postPdf(p, markdownBody, { site }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: M,
    bufferPages: true,
    autoFirstPage: true,
    lang: 'en-GB',
    displayTitle: true,
    pdfVersion: '1.7',
    info: {
      Title: p.title,
      Author: AUTHOR.name,
      Subject: p.description,
      Keywords: [p.category, ...p.tags].join(', '),
      Creator: `${BLOG_NAME} (${site}/blog)`,
      Producer: 'pdfkit',
      CreationDate: new Date(`${p.date}T09:00:00+05:00`),
      ModDate: new Date(`${p.updated ?? p.date}T09:00:00+05:00`),
    },
  })
  for (const [k, f] of Object.entries(FONTS)) doc.registerFont(k, f)
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((res) => doc.on('end', () => res(Buffer.concat(chunks))))

  const bottom = () => A4.h - M.bottom
  const ensure = (h) => {
    if (doc.y + h > bottom()) doc.addPage()
  }

  /** Write styled runs as one flowing paragraph. */
  function inline(rs, { x, width, size = BODY, base = 'serif', color = C.text, gap = 2.6, align = 'left', y } = {}) {
    const segs = []
    for (const r of rs) {
      if (!r.text) continue
      for (const part of glyphSafe(r.text, fontKey(r, base))) segs.push({ ...r, text: part.text, key: part.key })
    }
    if (!segs.length) return
    if (y !== undefined) doc.y = y
    segs.forEach((s, i) => {
      const last = i === segs.length - 1
      doc
        .font(s.key)
        .fontSize(s.code ? size * 0.86 : size)
        .fillColor(s.link ? C.link : color)
      const opts = { continued: !last, link: s.link ?? null, underline: !!s.link, strike: !!s.strike, lineGap: gap, align, features: s.key === 'mono' ? NOLIG : undefined }
      if (i === 0) doc.text(s.text, x, doc.y, { ...opts, width })
      else doc.text(s.text, opts)
    })
    doc.fillColor(C.text)
  }

  function block(n, x, width) {
    switch (n.type) {
      case 'heading': {
        const size = n.depth <= 2 ? 14.5 : n.depth === 3 ? 12 : 10.8
        ensure(size * 4)
        doc.y += n.depth <= 2 ? 12 : 8
        inline(runs(n.children, { bold: true }), { x, width, size, base: 'serifSemi', gap: 2 })
        doc.y += 5
        break
      }
      case 'paragraph': {
        const only = n.children.length === 1 && n.children[0].type === 'strong'
        if (only) ensure(40) // bold "kicker" lines stay with what follows
        inline(runs(n.children), { x, width })
        doc.y += 7
        break
      }
      case 'list': {
        let i = n.start ?? 1
        for (const item of n.children) {
          ensure(18)
          const y0 = doc.y
          const marker = item.checked === true ? '☑' : item.checked === false ? '☐' : n.ordered ? `${i++}.` : '•'
          doc.font(marker.length > 1 || /[☑☐]/.test(marker) ? (/[☑☐]/.test(marker) ? 'mono' : 'serif') : 'serif').fontSize(BODY).fillColor(C.muted)
          doc.text(marker, x, y0, { width: 16, lineBreak: false })
          doc.fillColor(C.text)
          doc.y = y0
          item.children.forEach((c, k) => {
            if (c.type === 'paragraph') {
              inline(runs(c.children), { x: x + 18, width: width - 18 })
              doc.y += k === item.children.length - 1 ? 3.5 : 5
            } else block(c, x + 18, width - 18)
          })
        }
        doc.y += 4
        break
      }
      case 'blockquote': {
        const page = doc.bufferedPageRange().count
        const y0 = doc.y
        for (const c of n.children) block(c, x + 14, width - 14)
        const sameP = doc.bufferedPageRange().count === page
        doc
          .moveTo(x + 3, sameP ? y0 : M.top)
          .lineTo(x + 3, doc.y - 6)
          .lineWidth(2)
          .strokeColor(C.line)
          .stroke()
        doc.y += 2
        break
      }
      case 'code': {
        const size = 8.3
        const lh = size * 1.5
        doc.font('mono').fontSize(size)
        const lines = n.value.replace(/\t/g, '  ').split('\n')
        ensure(Math.min(lines.length, 4) * lh + 12)
        doc.y += 2
        const pad = 8
        let first = true
        for (const raw of lines) {
          const line = raw || ' '
          const h = doc.heightOfString(line, { width: width - pad * 2, lineGap: lh - size * 1.17, features: NOLIG }) || lh
          if (doc.y + h + (first ? pad : 0) > bottom()) {
            doc.addPage()
            first = true
          }
          const top = doc.y
          doc.rect(x, top, width, h + (first ? pad : 0)).fill(C.soft)
          doc.fillColor(C.text2).font('mono').fontSize(size)
          const parts = glyphSafe(line, 'mono')
          parts.forEach((pt, i) => {
            doc.font(pt.key).fontSize(size)
            if (i === 0) doc.text(pt.text, x + pad, top + (first ? pad : 0), { width: width - pad * 2, lineGap: lh - size * 1.17, continued: parts.length > 1, features: NOLIG })
            else doc.text(pt.text, { continued: i < parts.length - 1, features: NOLIG })
          })
          doc.y = top + h + (first ? pad : 0)
          first = false
        }
        doc.rect(x, doc.y, width, pad).fill(C.soft)
        doc.y += pad + 9
        doc.fillColor(C.text)
        break
      }
      case 'math': {
        ensure(30)
        doc.font('mono').fontSize(9.5).fillColor(C.text2).text(n.value, x, doc.y, { width, align: 'center', lineGap: 3, features: NOLIG })
        doc.fillColor(C.text)
        doc.y += 8
        break
      }
      case 'table': {
        const cols = n.children[0]?.children.length ?? 1
        const cw = width / cols
        const pad = 5
        const size = 9
        doc.y += 2
        n.children.forEach((row, ri) => {
          doc.font(ri === 0 ? 'sansSemi' : 'sans').fontSize(size)
          const hs = row.children.map((cell) => doc.heightOfString(plain(cell.children) || ' ', { width: cw - pad * 2, lineGap: 1.5 }))
          const h = Math.max(...hs) + pad * 2
          if (doc.y + h > bottom()) doc.addPage()
          const top = doc.y
          if (ri === 0) doc.rect(x, top, width, h).fill(C.soft)
          row.children.forEach((cell, ci) => {
            inline(runs(cell.children, ri === 0 ? { bold: true } : {}), { x: x + ci * cw + pad, width: cw - pad * 2, size, base: 'sans', gap: 1.5, y: top + pad })
          })
          doc
            .moveTo(x, top + h)
            .lineTo(x + width, top + h)
            .lineWidth(ri === 0 ? 0.9 : 0.5)
            .strokeColor(C.line)
            .stroke()
          doc.y = top + h
        })
        doc.y += 10
        break
      }
      case 'thematicBreak': {
        ensure(20)
        doc.y += 6
        doc.moveTo(x + width * 0.4, doc.y).lineTo(x + width * 0.6, doc.y).lineWidth(0.7).strokeColor(C.line).stroke()
        doc.y += 12
        break
      }
      case 'html':
      case 'definition':
      case 'yaml':
        break
      default:
        if (n.children) for (const c of n.children) block(c, x, width)
    }
  }

  // a post's own <Abstract> becomes the page-1 abstract (instead of the description)
  const tree = fromMarkdown(markdownBody, { extensions: [gfm(), math()], mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()] })
  const [k0, k1] = tree.children
  let abstract = [{ text: p.description }]
  if (k0?.type === 'paragraph' && k0.children.length === 1 && k0.children[0].type === 'strong' && /^abstract$/i.test(plain(k0.children)) && k1?.type === 'paragraph') {
    abstract = runs(k1.children)
    tree.children.splice(0, 2)
  }

  /* ---- front matter (page 1) */
  const lic = LICENSES[p.license]
  const url = `${site}/blog/${p.slug}`
  doc.font('sansSemi').fontSize(8).fillColor(C.muted).text(`${BLOG_NAME.toUpperCase()}  ·  ${p.category.toUpperCase()}${lic.open ? '  ·  OPEN ACCESS' : ''}`, M.left, M.top, { characterSpacing: 1.2, width: W })
  doc.y += 10
  inline([{ text: p.title }], { x: M.left, width: W, size: 24, base: 'serifBold', gap: 1 })
  doc.y += 10
  doc.font('sansSemi').fontSize(12).fillColor(C.text).text(AUTHOR.name, M.left, doc.y, { width: W })
  doc.y += 3
  // ORCID iD: green icon + full URL (ORCID display guidelines)
  const iy = doc.y
  doc.circle(M.left + 5.5, iy + 5.5, 5.5).fill('#A6CE39')
  doc.font('sansSemi').fontSize(5.6).fillColor('#ffffff').text('iD', M.left + 1.9, iy + 2.9, { lineBreak: false })
  doc.font('sans').fontSize(9).fillColor(C.link).text(AUTHOR.orcidUrl, M.left + 16, iy + 1, { link: AUTHOR.orcidUrl, underline: false, width: W - 16 })
  doc.fillColor(C.muted).font('sans').fontSize(9).text(`${AUTHOR.affiliation} · ${AUTHOR.location}`, M.left, doc.y + 2, { width: W })
  doc.y += 12

  const meta = [
    ['Published', p.updated ? `${p.date} (updated ${p.updated})` : p.date],
    p.doi ? ['DOI', doiUrl(p.doi), doiUrl(p.doi)] : null,
    ['URL', url, url],
    ['Licence', lic.open ? `${lic.name} (${lic.short}), ${lic.url}` : `© ${p.date.slice(0, 4)} ${AUTHOR.name}. All rights reserved. Code samples MIT.`, lic.url || null],
  ].filter(Boolean)
  for (const [k, v, link] of meta) {
    const y = doc.y
    doc.font('sansSemi').fontSize(8.6).fillColor(C.muted).text(k, M.left, y, { width: 64 })
    doc.font('sans').fontSize(8.6).fillColor(link ? C.link : C.text).text(v, M.left + 66, y, { width: W - 66, link: link ?? null })
    doc.y += 2.5
  }
  doc.y += 10

  // abstract box
  doc.font('serif').fontSize(BODY)
  const absH = doc.heightOfString(abstract.map((r) => r.text).join(''), { width: W - 28, lineGap: 2.6 }) + 54
  const by = doc.y
  doc.rect(M.left, by, W, absH).fill(C.box)
  doc.rect(M.left, by, 2.5, absH).fill(C.line)
  doc.font('sansSemi').fontSize(8).fillColor(C.muted).text('ABSTRACT', M.left + 14, by + 11, { characterSpacing: 1.2 })
  inline(abstract, { x: M.left + 14, width: W - 28, y: by + 25 })
  doc.font('sans').fontSize(8.4).fillColor(C.muted).text(`Keywords: ${p.tags.join(', ')}`, M.left + 14, doc.y + 4, { width: W - 28 })
  doc.y = by + absH + 18

  /* ---- body */
  for (const n of tree.children) block(n, M.left, W)

  /* ---- closing: cite as + licence */
  ensure(90)
  doc.y += 10
  doc.moveTo(M.left, doc.y).lineTo(M.left + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke()
  doc.y += 10
  doc.font('sansSemi').fontSize(8).fillColor(C.muted).text('CITE AS', M.left, doc.y, { characterSpacing: 1.2 })
  doc.y += 3
  inline([{ text: citation(p, 'apa', site) }], { x: M.left, width: W, size: 9.5, base: 'serif', color: C.text2 })
  doc.y += 6
  doc.font('sans').fontSize(8.4).fillColor(C.muted).text(lic.open ? `${lic.summary} Licence: ${lic.url}` : `© ${p.date.slice(0, 4)} ${AUTHOR.name}. ${lic.summary}`, M.left, doc.y, { width: W })

  /* ---- running header + footer on every page */
  const short = `${AUTHOR.familyName}, ${AUTHOR.givenName[0]}. (${p.date.slice(0, 4)}). ${p.title}. ${BLOG_NAME}.`
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const mb = doc.page.margins.bottom
    doc.page.margins.bottom = 0 // writing in the margin must not trigger a new page
    if (i > 0) {
      doc.font('sans').fontSize(7.6).fillColor(C.muted).text(`${BLOG_NAME}  ·  ${p.title}`, M.left, 34, { width: W, lineBreak: false, ellipsis: true })
    }
    doc.moveTo(M.left, A4.h - 52).lineTo(M.left + W, A4.h - 52).lineWidth(0.4).strokeColor(C.line).stroke()
    doc.font('sans').fontSize(7.4).fillColor(C.muted).text(short, M.left, A4.h - 44, { width: W - 60, lineBreak: false, ellipsis: true })
    doc.text(p.doi ? doiUrl(p.doi) : url, M.left, A4.h - 34, { width: W - 60, lineBreak: false, link: p.doi ? doiUrl(p.doi) : url })
    doc.text(`${i + 1} / ${range.count}`, M.left + W - 60, A4.h - 44, { width: 60, align: 'right', lineBreak: false })
    doc.page.margins.bottom = mb
  }
  doc.end()
  return done
}
