/**
 * Builds every portrait asset from one photo (assets/gulzaib.jpg) into public/img/gul/
 * and the favicons / app icons into public/.
 *
 *   hero-bw.webp, hero-color.webp   portfolio hero pill (black and white cut-out on lime / full colour)
 *   mark.webp                       portfolio logo: face on ink, inside the spinning ring
 *   avatar.webp, avatar-og.png      blog: warm-toned cut-out (transparent, the theme shows through)
 *   gulzaib.jpg                     plain profile photo (structured data, link previews)
 *   assets/og-person.png            black and white cut-out for the portfolio share image (built by scripts/og.mjs)
 *   /favicon.svg, /favicon-32.png, /apple-touch-icon.png, /icon-192.png, /icon-512.png
 *
 * Not part of the normal build (the outputs are committed). To run it again:
 *   npm i --prefix /tmp/imgtools sharp @imgly/background-removal-node
 *   PORTRAIT_TOOLS=/tmp/imgtools node scripts/portrait.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tools = createRequire(process.env.PORTRAIT_TOOLS ? path.join(process.env.PORTRAIT_TOOLS, 'noop.js') : import.meta.url)
const sharp = tools('sharp')
const { removeBackground } = tools('@imgly/background-removal-node')

const SRC = path.join(ROOT, 'assets/gulzaib.jpg')
const OUT = path.join(ROOT, 'public/img/gul')
const PUB = path.join(ROOT, 'public')
fs.mkdirSync(OUT, { recursive: true })

const INK = '#07070a'
const LIME = '#c6ff3d'
const BLUE = '#5b8cff'

// ---------------------------------------------------------------- cut-out
const photo = fs.readFileSync(SRC)
const { width: W, height: H } = await sharp(photo).metadata()
const models = `file://${path.dirname(tools.resolve('@imgly/background-removal-node'))}/`
const cutBlob = await removeBackground(new Blob([photo], { type: 'image/jpeg' }), { publicPath: models, model: 'medium', output: { format: 'image/png', quality: 1 } })
const cut = Buffer.from(await cutBlob.arrayBuffer())

/** crop boxes in source pixels (400×400 photo) */
const FACE = { left: 117, top: 38, width: 156, height: 156 } // tight head
const BUST = { left: 66, top: 18, width: 264, height: 264 } // head + shoulders
const WIDE = { left: 50, top: 28, width: 300, height: 135 } // hero pill, 20:9

const scale = (box, f = W / 400) => Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * f)]))
const circleMask = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`)

/** black and white, a little punchier (keeps alpha) */
const bw = (img) => img.grayscale().linear(1.18, -14)
/** warm, slightly softer grade for the paper-toned blog */
const warm = (img) =>
  img.recomb([
    [1.06, 0.04, 0],
    [0.02, 1.0, 0],
    [0, 0.04, 0.86],
  ]).modulate({ saturation: 0.9, brightness: 1.02 })

// ------------------------------------------------------- portfolio: hero pill
{
  const box = scale(WIDE)
  const person = await bw(sharp(cut).extract(box)).png().toBuffer()
  await sharp({ create: { width: box.width, height: box.height, channels: 4, background: LIME } })
    .composite([{ input: person }])
    .webp({ quality: 84 })
    .toFile(path.join(OUT, 'hero-bw.webp'))
  await sharp(photo).extract(box).modulate({ saturation: 1.05 }).webp({ quality: 84 }).toFile(path.join(OUT, 'hero-color.webp'))
}

// --------------------------------------------- portfolio: logo mark (face on ink)
const faceOnInk = async (size) => {
  const face = await sharp(cut).extract(scale(FACE)).resize(size, size, { kernel: 'lanczos3' }).modulate({ saturation: 1.05 }).png().toBuffer()
  const glow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#22261a"/><stop offset="1" stop-color="${INK}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  )
  return sharp(glow).composite([{ input: face }]).png().toBuffer()
}
await sharp(await faceOnInk(128))
  .composite([{ input: circleMask(128), blend: 'dest-in' }])
  .webp({ quality: 88 })
  .toFile(path.join(OUT, 'mark.webp'))

// ------------------------------------------------- blog: warm transparent bust
{
  const bust = warm(sharp(cut).extract(scale(BUST)))
  await bust.clone().resize(192, 192, { kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT, 'avatar.webp'))
  await warm(sharp(cut).extract(scale(BUST))).resize(112, 112, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'avatar-og.png'))
}

// plain photo for structured data / link previews
await sharp(photo).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(OUT, 'gulzaib.jpg'))

// ------------------------------------------------------- favicons / app icons
const faceJpeg = (await sharp(await faceOnInk(128)).jpeg({ quality: 82, mozjpeg: true }).toBuffer()).toString('base64')
const iconSvg = ({ size = 64, bleed = false } = {}) => {
  // bleed: full-square background (app icons); otherwise a rounded tile (browser tab)
  const s = size
  const r = bleed ? s * 0.34 : s * 0.43 // photo radius
  const ring = bleed ? s * 0.035 : s * 0.06
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LIME}"/><stop offset="1" stop-color="${BLUE}"/></linearGradient>
    <clipPath id="c"><circle cx="${s / 2}" cy="${s / 2}" r="${r}"/></clipPath>
  </defs>
  <rect width="${s}" height="${s}" ${bleed ? '' : `rx="${s / 4}"`} fill="${INK}"/>
  <image href="data:image/jpeg;base64,${faceJpeg}" xlink:href="data:image/jpeg;base64,${faceJpeg}" x="${s / 2 - r}" y="${s / 2 - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="${s / 2}" cy="${s / 2}" r="${r + ring / 2}" fill="none" stroke="url(#g)" stroke-width="${ring}"/>
</svg>`
}
fs.writeFileSync(path.join(PUB, 'favicon.svg'), iconSvg())
const raster = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng()
const save = async (file, svg, w) => fs.writeFileSync(path.join(PUB, file), await sharp(raster(svg, w)).png({ compressionLevel: 9, palette: w > 32, quality: 92, effort: 10 }).toBuffer())
await save('favicon-32.png', iconSvg(), 32)
await save('apple-touch-icon.png', iconSvg({ size: 180, bleed: true }), 180)
await save('icon-192.png', iconSvg({ size: 192, bleed: true }), 192)
await save('icon-512.png', iconSvg({ size: 512, bleed: true }), 512)

// ------------------------------------- share-image cut-out (used by the build)
// black and white, 600 px tall, transparent: scripts/og.mjs puts it on the lime disc of /og/home.png
await bw(sharp(cut).extract(scale({ left: 40, top: 20, width: 340, height: 380 })))
  .resize({ height: 600, kernel: 'lanczos3' })
  .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
  .toFile(path.join(ROOT, 'assets/og-person.png'))

for (const f of [...fs.readdirSync(OUT).map((f) => `img/gul/${f}`), 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'])
  console.log(f.padEnd(28), `${(fs.statSync(path.join(PUB, f)).size / 1024).toFixed(1)} KB`)
