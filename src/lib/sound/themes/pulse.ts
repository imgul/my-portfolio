/**
 * NEON PULSE: warm synthwave / lo-fi electronic, 96 BPM, A minor.
 * Am9 → Fmaj9 → Cmaj7 → G6 (two bars each).
 * Layers: sidechain-pumped saw pad, syncopated sub bass, soft kick/clap/hats,
 * and a square-wave arpeggio. Scroll energy doubles the arp and hats to 16ths,
 * opens the filters and adds kick fills.
 */
import { mtof, osc, perc, noiseHit, noiseBuffer, type Rig } from '../rig'
import type { Theme } from '../types'

const BPM = 96
const STEP = 60 / BPM / 4 // 16th note
const CHORDS = [
  { root: 45, pad: [57, 60, 64, 67, 71] }, // Am9
  { root: 41, pad: [53, 57, 60, 64, 67] }, // Fmaj9
  { root: 48, pad: [55, 59, 60, 64, 67] }, // Cmaj7
  { root: 43, pad: [55, 59, 62, 64, 67] }, // G6
]
const SCALE = [57, 60, 62, 64, 67] // A minor pentatonic
const ARP = [0, 2, 1, 3, 2, 4, 3, 1]

export function createPulse(): Theme {
  let padFilter: BiquadFilterNode | null = null
  let duck: GainNode | null = null
  let voices: { gain: GainNode; oscs: OscillatorNode[] }[] = []
  let step = 0
  let nextStep = 0
  let chord = CHORDS[0]
  let energyNow = 0

  const synthPluck = (rig: Rig, m: number, t: number, vol: number, out: AudioNode, decay = 0.35, bright = 4200) => {
    const { ctx } = rig
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.Q.value = 4
    f.frequency.setValueAtTime(bright, t)
    f.frequency.exponentialRampToValueAtTime(500, t + decay)
    const g = ctx.createGain()
    perc(g.gain, t, vol, 0.003, decay)
    const a = osc(ctx, 'square', mtof(m), -6)
    const b = osc(ctx, 'sawtooth', mtof(m), 6)
    a.connect(f)
    b.connect(f)
    f.connect(g).connect(out)
    g.connect(rig.delaySend)
    g.connect(rig.reverbSend)
    a.start(t)
    b.start(t)
    a.stop(t + decay + 0.1)
    b.stop(t + decay + 0.1)
  }

  const kick = (rig: Rig, t: number, vol: number) => {
    const { ctx } = rig
    const o = osc(ctx, 'sine', 150)
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12)
    const g = ctx.createGain()
    perc(g.gain, t, vol, 0.002, 0.38)
    o.connect(g).connect(rig.musicBus)
    o.start(t)
    o.stop(t + 0.45)
    noiseHit(rig, t, { type: 'highpass', freq: 3000, peak: vol * 0.12, decay: 0.012, out: rig.musicBus })
    // sidechain duck on the pad
    if (duck) {
      duck.gain.cancelScheduledValues(t)
      duck.gain.setValueAtTime(1, t)
      duck.gain.linearRampToValueAtTime(0.3, t + 0.01)
      duck.gain.setTargetAtTime(1, t + 0.04, 0.11)
    }
  }

  const clap = (rig: Rig, t: number, vol: number) => {
    for (let i = 0; i < 3; i++) {
      const g = noiseHit(rig, t + i * 0.011, { type: 'bandpass', freq: 1400, q: 0.9, peak: vol * (i === 2 ? 1 : 0.6), decay: i === 2 ? 0.17 : 0.02, out: rig.musicBus })
      if (i === 2) g.connect(rig.reverbSend)
    }
  }

  const hat = (rig: Rig, t: number, vol: number, open: boolean, pan: number) => {
    noiseHit(rig, t, { type: 'highpass', freq: 7500, q: 0.5, peak: vol, decay: open ? 0.11 : 0.03, out: rig.musicBus, pan })
  }

  const bass = (rig: Rig, m: number, t: number, energy: number) => {
    const { ctx } = rig
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.Q.value = 6
    f.frequency.setValueAtTime(260 + 700 + energy * 1200, t)
    f.frequency.exponentialRampToValueAtTime(240, t + 0.22)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.09, t + 0.006)
    g.gain.setTargetAtTime(0.055, t + 0.02, 0.08)
    g.gain.setTargetAtTime(0.0001, t + STEP * 2.2, 0.03)
    const a = osc(ctx, 'sawtooth', mtof(m))
    const sub = osc(ctx, 'sine', mtof(m))
    const sg = ctx.createGain()
    sg.gain.value = 0.9
    a.connect(f).connect(g)
    sub.connect(sg).connect(g)
    g.connect(rig.musicBus)
    a.start(t)
    sub.start(t)
    a.stop(t + STEP * 3)
    sub.stop(t + STEP * 3)
  }

  const release = (t: number, tau: number) => {
    for (const v of voices) {
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0, t, tau)
      v.oscs.forEach((o) => o.stop(t + tau * 6))
    }
    voices = []
  }

  const pad = (rig: Rig, t: number) => {
    const { ctx } = rig
    release(t, 0.25)
    chord.pad.forEach((m) => {
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setTargetAtTime(0.024, t, 0.35)
      g.connect(padFilter!)
      const oscs = [-11, 11].map((d) => {
        const o = osc(ctx, 'sawtooth', mtof(m), d + Math.random() * 3)
        o.connect(g)
        o.start(t)
        return o
      })
      voices.push({ gain: g, oscs })
    })
  }

  const playStep = (rig: Rig, t: number, energy: number) => {
    const s = step % 32
    const b = step % 16
    if (s === 0) {
      chord = CHORDS[Math.floor(step / 32) % CHORDS.length]
      pad(rig, t)
    }
    const swing = b % 2 === 1 ? STEP * 0.12 : 0
    const tt = t + swing

    // drums: half-time when calm, full groove when the visitor scrolls
    const moving = energy > 0.3
    if (b === 0 || (moving && b === 8)) kick(rig, t, 0.5 + energy * 0.25)
    if (energy > 0.55 && (b === 11 || (b === 14 && s >= 16))) kick(rig, t, 0.32 + energy * 0.2)
    if (b === 12 || (moving && b === 4)) clap(rig, t, 0.08 + energy * 0.08)
    if (b % 4 === 2) hat(rig, t, 0.045 + energy * 0.025, true, 0.25)
    else if (b % 4 === 0) hat(rig, t, 0.028, false, -0.2)
    else if (moving) hat(rig, tt, 0.018 + energy * 0.018, false, -0.35)

    // bass
    if ([0, 3, 6, 8, 11].includes(b)) bass(rig, chord.root, t, energy)
    if (b === 14) bass(rig, chord.root + 12, t, energy)

    // arpeggio (8ths when calm, 16ths + brighter when moving)
    if (b % 2 === 0 || moving) {
      const idx = ARP[step % ARP.length]
      const m = chord.pad[idx] + 12
      synthPluck(rig, m, tt, 0.03 + energy * 0.03, rig.musicBus, 0.22, 2200 + energy * 4000)
    }
  }

  return {
    fx: {
      reverbSeconds: 2.4,
      reverbDecay: 3,
      reverbLevel: 0.55,
      delayTime: STEP * 3, // dotted 8th
      delayFeedback: 0.35,
      delayTone: 3200,
      musicLevel: 0.62,
      sfxLevel: 0.7,
    },
    start(rig, t) {
      const { ctx } = rig
      padFilter = ctx.createBiquadFilter()
      padFilter.type = 'lowpass'
      padFilter.frequency.value = 900
      padFilter.Q.value = 1.2
      duck = ctx.createGain()
      padFilter.connect(duck)
      duck.connect(rig.musicBus)
      duck.connect(rig.reverbSend)
      step = 0
      nextStep = t + 0.05
    },
    tick(rig, now, horizon, energy) {
      energyNow = energy
      padFilter!.frequency.setTargetAtTime(1300 + energy * 3200, now, 0.2)
      while (horizon >= nextStep) {
        playStep(rig, nextStep, energyNow)
        step++
        nextStep += STEP
      }
    },
    stop(_rig, t) {
      release(t, 0.3)
    },
    sfx: {
      hover(rig, t) {
        const { ctx } = rig
        const o = osc(ctx, 'square', 2400)
        o.frequency.setValueAtTime(2400, t)
        o.frequency.exponentialRampToValueAtTime(1700, t + 0.03)
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 4500
        const g = ctx.createGain()
        perc(g.gain, t, 0.022, 0.001, 0.04)
        o.connect(f).connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 0.06)
      },
      click(rig, t) {
        ;[76, 83].forEach((m, i) => synthPluck(rig, m, t + i * 0.05, 0.06, rig.sfxBus, 0.12, 5000))
      },
      whoosh(rig, t, strength) {
        const { ctx } = rig
        const dur = 0.8
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx)
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.Q.value = 2.2
        f.frequency.setValueAtTime(250, t)
        f.frequency.exponentialRampToValueAtTime(6000, t + dur)
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.1 * strength, t + dur * 0.9)
        g.gain.linearRampToValueAtTime(0, t + dur + 0.05)
        src.connect(f).connect(g).connect(rig.sfxBus)
        g.connect(rig.delaySend)
        src.start(t, 0, dur + 0.1)
        // landing "zap" + sub thump
        const z = osc(ctx, 'sine', 900)
        z.frequency.setValueAtTime(900, t + dur)
        z.frequency.exponentialRampToValueAtTime(45, t + dur + 0.25)
        const zg = ctx.createGain()
        perc(zg.gain, t + dur, 0.16 * strength, 0.004, 0.3)
        z.connect(zg).connect(rig.sfxBus)
        z.start(t + dur)
        z.stop(t + dur + 0.4)
      },
      success(rig, t) {
        ;[69, 72, 76, 81, 84].forEach((m, i) => synthPluck(rig, m, t + i * 0.055, 0.07, rig.sfxBus, 0.3, 5200))
      },
      note(rig, t, i, vel) {
        const k = ((i % 13) + 13) % 13
        synthPluck(rig, SCALE[k % 5] + 12 * Math.floor(k / 5), t, 0.08 * vel, rig.sfxBus, 0.4, 4600)
      },
      boot(rig, t) {
        const { ctx } = rig
        // sub drop
        const o = osc(ctx, 'sine', 160)
        o.frequency.setValueAtTime(160, t)
        o.frequency.exponentialRampToValueAtTime(38, t + 1)
        const g = ctx.createGain()
        perc(g.gain, t, 0.4, 0.01, 1.2)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 1.3)
        // chord stab with a filter sweep
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.Q.value = 5
        f.frequency.setValueAtTime(300, t)
        f.frequency.exponentialRampToValueAtTime(5200, t + 0.45)
        f.frequency.exponentialRampToValueAtTime(700, t + 1.8)
        const sg = ctx.createGain()
        perc(sg.gain, t, 0.05, 0.02, 2)
        f.connect(sg).connect(rig.sfxBus)
        sg.connect(rig.reverbSend)
        sg.connect(rig.delaySend)
        CHORDS[0].pad.forEach((m) =>
          [-12, 12].forEach((d) => {
            const s = osc(ctx, 'sawtooth', mtof(m), d)
            s.connect(f)
            s.start(t)
            s.stop(t + 2.1)
          }),
        )
        ;[69, 76, 81].forEach((m, i) => synthPluck(rig, m + 12, t + 0.3 + i * STEP * 2, 0.05, rig.sfxBus, 0.3, 5000))
      },
    },
  }
}
