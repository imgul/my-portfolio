/**
 * Tiny UI sounds for link previews. Synthesised with Web Audio (no files)
 * and kept very quiet: a soft, airy "pop" when a card opens, a lower
 * "tuck" when it closes, a short tick when it moves to another link and
 * a bright chirp for copy. Each site decides whether sounds are on.
 */
type Sound = 'open' | 'close' | 'move' | 'go' | 'copy'

let ctx: AudioContext | null = null
let out: GainNode | null = null
let last = 0

function context() {
  if (ctx) return ctx
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  out = ctx.createGain()
  out.gain.value = 0.5
  // a gentle low-pass keeps every sound soft
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 6500
  out.connect(lp).connect(ctx.destination)
  return ctx
}

/** Browsers only allow audio after a gesture; call this from one. */
export function unlockSfx() {
  const c = context()
  if (c && c.state === 'suspended') void c.resume().catch(() => {})
}

function blip(c: AudioContext, t: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export function playSfx(s: Sound) {
  if (typeof window === 'undefined') return
  const c = ctx
  if (!c || c.state !== 'running' || !out) return
  const now = c.currentTime
  // never stack sounds faster than ~25/s
  if (now - last < 0.04) return
  last = now
  const t = now + 0.005
  switch (s) {
    case 'open':
      blip(c, t, 880, 1320, 0.09, 0.05)
      blip(c, t + 0.012, 1760, 2400, 0.06, 0.018, 'triangle')
      break
    case 'move':
      blip(c, t, 1400, 1550, 0.035, 0.022)
      break
    case 'close':
      blip(c, t, 900, 560, 0.08, 0.03)
      break
    case 'go':
      blip(c, t, 660, 990, 0.07, 0.045)
      blip(c, t + 0.05, 990, 1480, 0.08, 0.035)
      break
    case 'copy':
      blip(c, t, 1240, 1240, 0.05, 0.035, 'triangle')
      blip(c, t + 0.06, 1860, 1860, 0.09, 0.03, 'triangle')
      break
  }
}
