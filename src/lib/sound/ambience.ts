/**
 * Ambient textures that sit under the music and change with each section:
 *  air    soft wind (looped noise through a drifting band-pass)
 *  birds  synthesized birdsong (Margalla Hills mornings)
 *  clock  a tick-tock locked to the theme's tempo (the Journey timeline)
 *  data   quiet digital chatter quantized to 16ths (Stack / Agents)
 *  vinyl  record crackle (reflective sections)
 */
import { crackleBuffer, mtof, noiseBuffer, osc, perc, type Rig } from './rig'
import type { AmbienceName } from './scenes'

export class Ambience {
  private rig: Rig
  private bus: GainNode
  private gains = {} as Record<AmbienceName, GainNode>
  private levels: Record<AmbienceName, number> = { air: 0, birds: 0, clock: 0, data: 0, vinyl: 0 }
  private loops: AudioBufferSourceNode[] = []
  private lfo: OscillatorNode | null = null
  private started = false
  private nextBird = 0
  private nextStep = 0
  private step = 0
  private beat = 0.6

  constructor(rig: Rig) {
    this.rig = rig
    this.bus = rig.ctx.createGain()
    this.bus.gain.value = 0.9
    this.bus.connect(rig.master)
    ;(['air', 'birds', 'clock', 'data', 'vinyl'] as AmbienceName[]).forEach((k) => {
      const g = rig.ctx.createGain()
      g.gain.value = 0
      g.connect(this.bus)
      this.gains[k] = g
    })
  }

  /** Begin the continuous loops and lock the grid to a tempo. */
  start(t: number, bpm: number, gridStart: number) {
    this.setTempo(bpm, gridStart)
    if (this.started) return
    this.started = true
    const { ctx } = this.rig
    // wind
    const wind = ctx.createBufferSource()
    wind.buffer = noiseBuffer(ctx)
    wind.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700
    bp.Q.value = 0.6
    this.lfo = osc(ctx, 'sine', 0.07)
    const lg = ctx.createGain()
    lg.gain.value = 420
    this.lfo.connect(lg).connect(bp.frequency)
    const wg = ctx.createGain()
    wg.gain.value = 0.11
    wind.connect(bp).connect(wg).connect(this.gains.air)
    // vinyl
    const vin = ctx.createBufferSource()
    vin.buffer = crackleBuffer(ctx)
    vin.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900
    const vlp = ctx.createBiquadFilter()
    vlp.type = 'lowpass'
    vlp.frequency.value = 5200
    const vg = ctx.createGain()
    vg.gain.value = 0.5
    vin.connect(hp).connect(vlp).connect(vg).connect(this.gains.vinyl)
    wind.start(t)
    vin.start(t)
    this.lfo.start(t)
    this.loops = [wind, vin]
    this.nextBird = t + 1
  }

  setTempo(bpm: number, gridStart: number) {
    this.beat = 60 / bpm
    this.nextStep = gridStart
    this.step = 0
  }

  set(levels: Partial<Record<AmbienceName, number>>, t: number) {
    ;(Object.keys(this.gains) as AmbienceName[]).forEach((k) => {
      const v = levels[k] ?? 0
      this.levels[k] = v
      const g = this.gains[k].gain
      g.cancelScheduledValues(t)
      g.setTargetAtTime(v, t, 1.4)
    })
  }

  tick(now: number, horizon: number) {
    if (!this.started) return
    const sixteenth = this.beat / 4
    while (horizon >= this.nextStep) {
      const t = this.nextStep
      if (this.levels.clock > 0.01 && this.step % 4 === 0) this.tickTock(t, (this.step / 4) % 2 === 0)
      if (this.levels.data > 0.01 && Math.random() < 0.22) this.blip(t)
      this.step++
      this.nextStep += sixteenth
    }
    if (this.levels.birds > 0.01) {
      while (horizon >= this.nextBird) {
        this.birdPhrase(this.nextBird)
        this.nextBird += 2.2 + Math.random() * 4.5
      }
    } else if (this.nextBird < now) this.nextBird = now + 0.5
  }

  private tickTock(t: number, tick: boolean) {
    const { ctx } = this.rig
    const o = osc(ctx, 'sine', tick ? 2900 : 2200)
    const g = ctx.createGain()
    perc(g.gain, t, 0.05, 0.001, 0.02)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = tick ? 3200 : 2400
    bp.Q.value = 3
    o.connect(bp).connect(g).connect(this.gains.clock)
    g.connect(this.rig.reverbSend)
    o.start(t)
    o.stop(t + 0.04)
  }

  private blip(t: number) {
    const { ctx } = this.rig
    const m = 88 + Math.floor(Math.random() * 5) * 3
    const o = osc(ctx, Math.random() < 0.5 ? 'sine' : 'square', mtof(m))
    if (Math.random() < 0.3) o.frequency.exponentialRampToValueAtTime(mtof(m + 12), t + 0.04)
    const g = ctx.createGain()
    perc(g.gain, t, 0.012, 0.001, 0.035 + Math.random() * 0.04)
    const p = ctx.createStereoPanner()
    p.pan.value = Math.random() * 1.6 - 0.8
    o.connect(g).connect(p).connect(this.gains.data)
    g.connect(this.rig.delaySend)
    o.start(t)
    o.stop(t + 0.1)
  }

  private birdPhrase(t: number) {
    const { ctx } = this.rig
    const pan = Math.random() * 1.6 - 0.8
    const base = 2400 + Math.random() * 1600
    const kind = Math.floor(Math.random() * 3)
    const n = 2 + Math.floor(Math.random() * 5)
    let at = t
    for (let i = 0; i < n; i++) {
      const dur = kind === 0 ? 0.07 : kind === 1 ? 0.12 : 0.05
      const o = osc(ctx, 'sine', base)
      const f0 = base * (kind === 1 ? 0.8 : 1.15)
      const f1 = base * (kind === 1 ? 1.35 : 0.7)
      o.frequency.setValueAtTime(f0, at)
      o.frequency.exponentialRampToValueAtTime(f1, at + dur)
      // quick warble
      const am = osc(ctx, 'sine', 30 + Math.random() * 30)
      const amg = ctx.createGain()
      amg.gain.value = base * 0.04
      am.connect(amg).connect(o.frequency)
      const g = ctx.createGain()
      perc(g.gain, at, 0.02 + Math.random() * 0.012, 0.008, dur)
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      o.connect(g).connect(p).connect(this.gains.birds)
      g.connect(this.rig.reverbSend)
      o.start(at)
      am.start(at)
      o.stop(at + dur + 0.05)
      am.stop(at + dur + 0.05)
      at += dur + 0.03 + Math.random() * 0.08
    }
  }

  stop(t: number) {
    this.loops.forEach((l) => l.stop(t))
    this.lfo?.stop(t)
    this.loops = []
    this.started = false
  }
}
