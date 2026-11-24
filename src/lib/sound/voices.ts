/** Reusable synth voices shared by several themes. */
import { mtof, osc, perc, noiseHit, type Rig } from './rig'

export interface Held {
  gain: GainNode
  oscs: OscillatorNode[]
}

/** Rhodes-like FM electric piano note. `hold` keeps it ringing until released. */
export function epiano(
  rig: Rig,
  m: number,
  t: number,
  vel: number,
  out: AudioNode,
  opts: { level?: number; bright?: number; wobble?: AudioNode | null; hold?: boolean } = {},
): Held {
  const { ctx } = rig
  const f = mtof(m)
  const car = osc(ctx, 'sine', f)
  const mod = osc(ctx, 'sine', f)
  const idx = ctx.createGain()
  idx.gain.value = 0
  idx.gain.setValueAtTime(f * (opts.bright ?? 1.4) * vel, t)
  idx.gain.setTargetAtTime(f * 0.12, t, 0.35)
  mod.connect(idx).connect(car.frequency)
  if (opts.wobble) {
    opts.wobble.connect(car.detune)
    opts.wobble.connect(mod.detune)
  }
  const level = (opts.level ?? 0.06) * vel
  const g = ctx.createGain()
  g.gain.value = 0
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(level, t + 0.005)
  g.gain.setTargetAtTime(level * 0.33, t + 0.01, 0.7)
  car.connect(g).connect(out)
  g.connect(rig.reverbSend)
  car.start(t)
  mod.start(t)
  if (!opts.hold) {
    g.gain.setTargetAtTime(0, t + 1.3, 0.4)
    car.stop(t + 3.6)
    mod.stop(t + 3.6)
  }
  return { gain: g, oscs: [car, mod] }
}

export function release(voices: Held[], t: number, tau: number) {
  for (const v of voices) {
    v.gain.gain.cancelScheduledValues(t)
    v.gain.gain.setTargetAtTime(0, t, tau)
    v.oscs.forEach((o) => {
      try {
        o.stop(t + tau * 6)
      } catch {
        /* already stopped */
      }
    })
  }
  voices.length = 0
}

/** Glassy FM bell. */
export function bell(rig: Rig, m: number, t: number, vol: number, out: AudioNode, decay = 2.2, ratio = 3.5) {
  const { ctx } = rig
  const f = mtof(m)
  const car = osc(ctx, 'sine', f)
  const mod = osc(ctx, 'sine', f * ratio)
  const idx = ctx.createGain()
  idx.gain.value = 0
  idx.gain.setValueAtTime(f * 2.2, t)
  idx.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6)
  mod.connect(idx).connect(car.frequency)
  const g = ctx.createGain()
  perc(g.gain, t, vol, 0.003, decay)
  car.connect(g).connect(out)
  g.connect(rig.reverbSend)
  g.connect(rig.delaySend)
  car.start(t)
  mod.start(t)
  car.stop(t + decay + 0.1)
  mod.stop(t + decay + 0.1)
}

export function kick(rig: Rig, t: number, vol: number, out: AudioNode, from = 120, to = 45, decay = 0.32) {
  const { ctx } = rig
  const o = osc(ctx, 'sine', from)
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(to, t + 0.11)
  const g = ctx.createGain()
  perc(g.gain, t, vol, 0.002, decay)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + decay + 0.05)
  noiseHit(rig, t, { type: 'highpass', freq: 2500, peak: vol * 0.1, decay: 0.01, out })
}

export function snare(rig: Rig, t: number, vol: number, out: AudioNode, tone = 190, color = 1800) {
  const { ctx } = rig
  const o = osc(ctx, 'triangle', tone)
  o.frequency.setValueAtTime(tone * 1.4, t)
  o.frequency.exponentialRampToValueAtTime(tone, t + 0.03)
  const g = ctx.createGain()
  perc(g.gain, t, vol * 0.7, 0.002, 0.09)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.15)
  const n = noiseHit(rig, t, { type: 'bandpass', freq: color, q: 0.7, peak: vol, decay: 0.16, out })
  n.connect(rig.reverbSend)
}

export function hat(rig: Rig, t: number, vol: number, out: AudioNode, open = false, pan = 0) {
  noiseHit(rig, t, { type: 'highpass', freq: 7000, q: 0.5, peak: vol, decay: open ? 0.12 : 0.035, out, pan })
}
