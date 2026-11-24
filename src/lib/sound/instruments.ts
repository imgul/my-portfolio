/**
 * Acoustic-ish instruments for the per-section Soundtrack. All synthesized:
 *  feltPiano  soft hammer, warm tone, natural decay
 *  organ      drawbar pipe organ (the Interstellar sound)
 *  strings    warm, slow-bowed ensemble (three detuned saws, low-passed)
 *  pluck      Karplus-Strong string: guitar or pizzicato
 *  mallet     marimba / kalimba / music box / soft pipe (sine + one partial)
 *  flute      breathy wooden flute with delayed vibrato
 *  drone      a held sine (sub / pedal)
 *  tock       a soft, low clock tick
 * Every instrument plays into rig.musicBus (or `out`) and sends to the reverb,
 * so a piece can be faded as a whole by handing it a gated proxy rig.
 */
import { mtof, noiseBuffer, osc, perc, type Rig } from './rig'
import type { Held } from './voices'

export function feltPiano(r: Rig, m: number, t: number, vel: number, opts: { out?: AudioNode; decay?: number; level?: number } = {}) {
  const { ctx } = r
  const f = mtof(m)
  // higher notes ring shorter, like a real piano
  const decay = (opts.decay ?? 3.2) * Math.max(0.45, Math.min(1.3, 1.35 - (m - 48) / 60))
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 800 + vel * 1300
  lp.Q.value = 0.3
  const g = ctx.createGain()
  perc(g.gain, t, (opts.level ?? 0.06) * vel, 0.012, decay)
  for (const [ratio, amp] of [
    [1, 1],
    [2, 0.2],
    [3.01, 0.06],
    [4.02, 0.02],
  ]) {
    const o = osc(ctx, 'sine', f * ratio, Math.random() * 4 - 2)
    const og = ctx.createGain()
    og.gain.value = amp
    o.connect(og).connect(lp)
    o.start(t)
    o.stop(t + decay + 0.2)
  }
  lp.connect(g).connect(opts.out ?? r.musicBus)
  g.connect(r.reverbSend)
}

const DRAWBARS: [number, number][] = [
  [0.5, 0.3],
  [1, 1],
  [2, 0.5],
  [3, 0.2],
  [4, 0.16],
  [6, 0.05],
  [8, 0.04],
]

/** Pipe organ chord tone. Swells in slowly; release() it to let go. */
export function organ(r: Rig, m: number, t: number, level: number, swell = 0.9): Held {
  const { ctx } = r
  const f = mtof(m)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2400
  lp.Q.value = 0.2
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setTargetAtTime(level, t, swell)
  const oscs = DRAWBARS.map(([ratio, amp], k) => {
    const o = osc(ctx, 'sine', f * ratio, k % 2 ? 2.5 : -2.5)
    const og = ctx.createGain()
    og.gain.value = amp
    o.connect(og).connect(lp)
    o.start(t)
    return o
  })
  lp.connect(g).connect(r.musicBus)
  g.connect(r.reverbSend)
  return { gain: g, oscs }
}

/** Warm string ensemble note. Slow bow; release() it to let go. */
export function strings(r: Rig, m: number, t: number, level: number, opts: { bright?: number; attack?: number } = {}): Held {
  const { ctx } = r
  const f = mtof(m)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = opts.bright ?? 1200
  lp.Q.value = 0.5
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setTargetAtTime(level, t, opts.attack ?? 0.7)
  const vib = osc(ctx, 'sine', 4.4 + Math.random() * 0.9)
  const vg = ctx.createGain()
  vg.gain.value = 0
  vg.gain.setTargetAtTime(6, t + 0.4, 0.5)
  vib.connect(vg)
  const saws = [-8, 0, 8].map((d) => {
    const o = osc(ctx, 'sawtooth', f, d + Math.random() * 3 - 1.5)
    vg.connect(o.detune)
    o.connect(lp)
    o.start(t)
    return o
  })
  vib.start(t)
  lp.connect(g).connect(r.musicBus)
  g.connect(r.reverbSend)
  return { gain: g, oscs: [...saws, vib] }
}

/** Held sine: sub-bass or pedal tone. */
export function drone(r: Rig, m: number, t: number, level: number, type: OscillatorType = 'sine'): Held {
  const { ctx } = r
  const o = osc(ctx, type, mtof(m))
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setTargetAtTime(level, t, 1.2)
  o.connect(g).connect(r.musicBus)
  o.start(t)
  return { gain: g, oscs: [o] }
}

/* --------------------------- Karplus-Strong pluck --------------------------- */

const ksCache = new WeakMap<BaseAudioContext, Map<string, { buf: AudioBuffer; rate: number }>>()

function ksString(ctx: BaseAudioContext, m: number, loss: number, soft: number) {
  let cache = ksCache.get(ctx)
  if (!cache) ksCache.set(ctx, (cache = new Map()))
  const key = `${m}|${loss}|${soft}`
  const hit = cache.get(key)
  if (hit) return hit
  const sr = ctx.sampleRate
  const f = mtof(m)
  const N = Math.max(4, Math.floor(sr / f - 0.5))
  const len = Math.floor(sr * 2.6)
  const d = new Float32Array(len)
  // excitation: a burst of (smoothed) noise one period long
  const a = 0.12 + (1 - soft) * 0.75
  let lp = 0
  let mean = 0
  for (let i = 0; i < N; i++) {
    lp += (Math.random() * 2 - 1 - lp) * a
    d[i] = lp
    mean += lp
  }
  mean /= N
  let peak = 0
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs((d[i] -= mean)))
  for (let i = 0; i < N; i++) d[i] /= peak || 1
  // the string: averaging delay line (adds half a sample of delay)
  for (let i = N; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + (i > N ? d[i - N - 1] : 0))
  const buf = ctx.createBuffer(1, len, sr)
  buf.copyToChannel(d, 0)
  // retune the fractional period exactly via playback rate
  const out = { buf, rate: (f * (N + 0.5)) / sr }
  cache.set(key, out)
  return out
}

/** Plucked string. loss ≈ 0.996 → guitar, ≈ 0.985 → pizzicato. */
export function pluck(
  r: Rig,
  m: number,
  t: number,
  vel: number,
  opts: { loss?: number; soft?: number; level?: number; tone?: number; out?: AudioNode; pan?: number } = {},
) {
  const { ctx } = r
  const { buf, rate } = ksString(ctx, m, opts.loss ?? 0.996, opts.soft ?? 0.5)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = (opts.tone ?? 2600) * (0.55 + vel * 0.6)
  const g = ctx.createGain()
  const level = (opts.level ?? 0.12) * vel
  const len = buf.duration / rate
  g.gain.value = 0
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + 0.004)
  g.gain.setValueAtTime(level, t + len - 0.4)
  g.gain.linearRampToValueAtTime(0, t + len - 0.02)
  let last: AudioNode = g
  if (opts.pan) {
    const p = ctx.createStereoPanner()
    p.pan.value = opts.pan
    g.connect(p)
    last = p
  }
  src.connect(lp).connect(g)
  last.connect(opts.out ?? r.musicBus)
  last.connect(r.reverbSend)
  src.start(t)
  src.stop(t + len)
}

/**
 * Struck bar: a sine plus one inharmonic partial.
 *  marimba  ratio 3.93, decay ~1.1
 *  kalimba  ratio 5.4,  decay ~1.6
 *  pipe     ratio 2,    decay ~0.9 (soft organ-flute ostinato)
 */
export function mallet(
  r: Rig,
  m: number,
  t: number,
  vel: number,
  opts: { ratio?: number; partial?: number; decay?: number; level?: number; out?: AudioNode; pan?: number } = {},
) {
  const { ctx } = r
  const f = mtof(m)
  const decay = opts.decay ?? 1.1
  const level = (opts.level ?? 0.05) * vel
  const out = ctx.createGain()
  out.gain.value = 1
  const body = osc(ctx, 'sine', f)
  const bg = ctx.createGain()
  perc(bg.gain, t, level, 0.004, decay)
  body.connect(bg).connect(out)
  const part = osc(ctx, 'sine', f * (opts.ratio ?? 3.93))
  const pg = ctx.createGain()
  perc(pg.gain, t, level * (opts.partial ?? 0.3), 0.002, decay * 0.14)
  part.connect(pg).connect(out)
  let last: AudioNode = out
  if (opts.pan) {
    const p = ctx.createStereoPanner()
    p.pan.value = opts.pan
    out.connect(p)
    last = p
  }
  last.connect(opts.out ?? r.musicBus)
  last.connect(r.reverbSend)
  ;[body, part].forEach((o) => {
    o.start(t)
    o.stop(t + decay + 0.1)
  })
}

/** Breathy wooden flute (bansuri-ish): scoop into the note, vibrato blooms late. */
export function flute(r: Rig, m: number, t: number, dur: number, vel: number, level = 0.04) {
  const { ctx } = r
  const f = mtof(m)
  const peak = level * vel
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.1)
  g.gain.setValueAtTime(peak, t + dur)
  g.gain.linearRampToValueAtTime(0, t + dur + 0.28)
  const vib = osc(ctx, 'sine', 5.2)
  const vg = ctx.createGain()
  vg.gain.value = 0
  vg.gain.setValueAtTime(0, t + 0.25)
  vg.gain.linearRampToValueAtTime(14, t + Math.min(dur, 0.9))
  vib.connect(vg)
  const tones = (
    [
      ['sine', 1, 1],
      ['triangle', 1, 0.12],
      ['sine', 2, 0.08],
    ] as [OscillatorType, number, number][]
  ).map(([type, ratio, amp]) => {
    const o = osc(ctx, type, f * ratio)
    o.detune.setValueAtTime(-30, t)
    o.detune.linearRampToValueAtTime(0, t + 0.09)
    vg.connect(o.detune)
    const og = ctx.createGain()
    og.gain.value = amp
    o.connect(og).connect(g)
    return o
  })
  // breath
  const n = ctx.createBufferSource()
  n.buffer = noiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = f * 2
  bp.Q.value = 1.5
  const ng = ctx.createGain()
  ng.gain.value = 0
  ng.gain.setValueAtTime(0, t)
  ng.gain.linearRampToValueAtTime(peak * 0.5, t + 0.05)
  ng.gain.linearRampToValueAtTime(peak * 0.12, t + 0.3)
  ng.gain.setValueAtTime(peak * 0.12, t + dur)
  ng.gain.linearRampToValueAtTime(0, t + dur + 0.25)
  n.connect(bp).connect(ng).connect(r.musicBus)
  g.connect(r.musicBus)
  g.connect(r.reverbSend)
  ng.connect(r.reverbSend)
  const end = t + dur + 0.35
  ;[...tones, vib].forEach((o) => {
    o.start(t)
    o.stop(end)
  })
  n.start(t, Math.random(), dur + 0.4)
}

/** A soft, low clock tick (wooden, not a click). */
export function tock(r: Rig, t: number, level: number, high = true) {
  const { ctx } = r
  const f = high ? 1300 : 1000
  const o = osc(ctx, 'sine', f)
  o.frequency.setValueAtTime(f, t)
  o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.04)
  const g = ctx.createGain()
  perc(g.gain, t, level, 0.002, 0.05)
  o.connect(g).connect(r.musicBus)
  g.connect(r.reverbSend)
  o.start(t)
  o.stop(t + 0.1)
}
