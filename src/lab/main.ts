/**
 * Sound Lab (dev only, not part of the production build).
 *  - Live audition of every theme with an energy slider + SFX buttons.
 *  - window.renderPreview(id, seconds): renders a scripted "site visit"
 *    offline and returns a base64 WAV. Used to export preview files.
 */
import { THEMES, getTheme, createRig, applyFx, Conductor, SCENES, type Rig, type Theme } from '../lib/sound'

/* ----------------------------- Scripted visit ----------------------------- */

type Ev = [number, (th: Theme, rig: Rig, t: number) => void]

const SFX_SCRIPT: Ev[] = [
  [0.0, (th, r, t) => th.sfx.boot(r, t)],
  ...[5.0, 5.35, 5.7, 6.05].map((s): Ev => [s, (th, r, t) => th.sfx.hover(r, t)]),
  [7.0, (th, r, t) => th.sfx.click(r, t)],
  ...[11, 15.5, 20].map((s): Ev => [s, (th, r, t) => th.sfx.whoosh(r, t, 0.6)]),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 9, 11].map((n, i): Ev => [25 + i * 0.2, (th, r, t) => th.sfx.note(r, t, n, 1)]),
  [28.6, (th, r, t) => th.sfx.click(r, t)],
  [29.4, (th, r, t) => th.sfx.success(r, t)],
  [33, (th, r, t) => th.sfx.whoosh(r, t, 0.6)],
  ...[37.0, 37.3].map((s): Ev => [s, (th, r, t) => th.sfx.hover(r, t)]),
]

/** Pushed scroll velocity over time (0..1), like Lenis feeding the engine. */
function scrollPush(t: number) {
  if (t >= 10 && t < 20) return 0.55 + 0.4 * Math.abs(Math.sin(t * 1.3))
  if (t >= 32 && t < 35) return 0.5
  return 0
}

async function renderPreview(id: string, seconds = 44): Promise<string> {
  const sr = 44100
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr)
  const rig = createRig(ctx)
  const theme = getTheme(id).create()
  applyFx(rig, theme.fx, 0)
  rig.master.gain.setValueAtTime(0.8, 0)
  rig.master.gain.setValueAtTime(0.8, seconds - 4)
  rig.master.gain.linearRampToValueAtTime(0, seconds - 0.3)

  theme.start(rig, 0.6)
  let energy = 0
  for (let t = 0; t < seconds - 2; t += 0.1) {
    energy = Math.min(1, Math.max(energy * 0.92, scrollPush(t)))
    if (t >= 0.6) theme.tick(rig, t, t + 0.25, energy)
  }
  for (const [at, fn] of SFX_SCRIPT) if (at < seconds - 3) fn(theme, rig, at)

  const buf = await ctx.startRendering()
  return toWavBase64(buf)
}

function toWavBase64(buf: AudioBuffer) {
  const ch = buf.numberOfChannels
  const len = buf.length
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  data.setUint32(4, 36 + len * ch * 2, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true)
  data.setUint16(22, ch, true)
  data.setUint32(24, buf.sampleRate, true)
  data.setUint32(28, buf.sampleRate * ch * 2, true)
  data.setUint16(32, ch * 2, true)
  data.setUint16(34, 16, true)
  w(36, 'data')
  data.setUint32(40, len * ch * 2, true)
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  let peak = 0
  let off = 44
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]))
      peak = Math.max(peak, Math.abs(v))
      data.setInt16(off, v * 0x7fff, true)
      off += 2
    }
  ;(window as unknown as { lastPeak: number }).lastPeak = peak
  const bytes = new Uint8Array(data.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

;(window as unknown as { renderPreview: typeof renderPreview }).renderPreview = renderPreview

/**
 * A scripted scroll through every section of the site: the Conductor
 * re-arranges the music per section, with transition whooshes + stingers.
 */
async function renderTour(id: string, perSection = 6.5): Promise<string> {
  const sr = 44100
  const first = 1.2
  const seconds = first + perSection * SCENES.length + 3
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr)
  const rig = createRig(ctx)
  const theme = getTheme(id).create()
  applyFx(rig, theme.fx, 0)
  rig.master.gain.setValueAtTime(0.8, 0)
  rig.master.gain.setValueAtTime(0.8, seconds - 3.5)
  rig.master.gain.linearRampToValueAtTime(0, seconds - 0.3)
  theme.sfx.boot(rig, 0)
  const c = new Conductor(rig, theme)
  c.start(0.6)
  const changeAt = (k: number) => first + perSection * k
  let energy = 0
  let next = 1
  for (let t = 0.6; t < seconds - 2; t += 0.1) {
    // the visitor scrolls for ~1.4 s before every section change
    const upcoming = next < SCENES.length ? changeAt(next) : Infinity
    const push = t > upcoming - 1.4 && t < upcoming + 0.2 ? 0.7 : 0
    energy = Math.min(1, Math.max(energy * 0.92, push))
    if (t >= upcoming) {
      theme.sfx.whoosh(rig, upcoming - 0.75, 0.6)
      c.setScene(next, upcoming, true)
      next++
    }
    c.tick(t, t + 0.25, energy)
  }
  const buf = await ctx.startRendering()
  return toWavBase64(buf)
}
;(window as unknown as { renderTour: typeof renderTour }).renderTour = renderTour

/* ------------------------------ Live audition ------------------------------ */

let ctx: AudioContext | null = null
let rig: Rig | null = null
let theme: Theme | null = null
let activeId = ''
let timer = 0
let energy = 0
let autoScroll = false
const slider = document.getElementById('energy') as HTMLInputElement | null
const energyVal = document.getElementById('energyVal')

function ensure() {
  if (!ctx) {
    ctx = new AudioContext()
    rig = createRig(ctx)
    rig.master.gain.value = 0.8
  }
  if (ctx.state === 'suspended') ctx.resume()
  return { ctx, rig: rig! }
}

function play(id: string) {
  const { ctx, rig } = ensure()
  const t = ctx.currentTime
  if (theme) theme.stop(rig, t)
  theme = getTheme(id).create()
  applyFx(rig, theme.fx, t)
  theme.start(rig, t + 0.1)
  activeId = id
  clearInterval(timer)
  timer = window.setInterval(() => {
    const now = ctx.currentTime
    const target = autoScroll ? 0.55 + 0.4 * Math.abs(Math.sin(now * 1.3)) : Number(slider?.value ?? 0)
    energy = autoScroll ? Math.max(energy * 0.92, target) : target
    if (energyVal) energyVal.textContent = energy.toFixed(2)
    theme!.tick(rig, now, now + 0.25, energy)
  }, 100)
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('is-on', (c as HTMLElement).dataset.id === id))
}

function sfx(id: string, name: keyof Theme['sfx']) {
  const { ctx, rig } = ensure()
  const th = id === activeId && theme ? theme : getTheme(id).create()
  if (th !== theme) applyFx(rig, th.fx)
  const t = ctx.currentTime
  if (name === 'note') [0, 2, 4, 5, 7, 9].forEach((n, i) => th.sfx.note(rig, t + i * 0.12, n, 1))
  else if (name === 'whoosh') th.sfx.whoosh(rig, t, 0.8)
  else (th.sfx[name] as (r: Rig, t: number) => void).call(th.sfx, rig, t)
}

const host = document.getElementById('themes')
if (host) {
  for (const t of THEMES) {
    const el = document.createElement('section')
    el.className = 'card'
    el.dataset.id = t.id
    el.innerHTML = `<h2>${t.name}</h2><p>${t.tagline}</p>
      <button class="primary" data-act="play">▶ Play music</button>
      ${['boot', 'hover', 'click', 'whoosh', 'note', 'success'].map((s) => `<button data-act="${s}">${s}</button>`).join('')}
      <a href="/?sound=${t.id}">Use on site →</a>`
    el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset.act
      if (!act) return
      if (act === 'play') play(t.id)
      else sfx(t.id, act as keyof Theme['sfx'])
    })
    host.appendChild(el)
  }
  document.getElementById('auto')?.addEventListener('click', () => {
    autoScroll = !autoScroll
    ;(document.getElementById('auto') as HTMLButtonElement).textContent = autoScroll ? 'Stop simulating' : 'Simulate scrolling'
  })
  document.getElementById('stop')?.addEventListener('click', () => {
    clearInterval(timer)
    if (theme && rig && ctx) theme.stop(rig, ctx.currentTime)
    theme = null
    activeId = ''
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('is-on'))
  })
}
