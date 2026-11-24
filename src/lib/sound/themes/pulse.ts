/**
 * NEON PULSE: warm synthwave / lo-fi electronic, 96 BPM, A minor.
 * Am9 → Fmaj9 → Cmaj7 → G6 (two bars each).
 * Layers: pad = sidechain-pumped saws · bass = syncopated sub · drums = kick + clap
 * perc = hats · arp = square arpeggio · lead = a composed synth hook.
 * Scroll energy / scene drive double the arp + hats to 16ths, open filters, add kick fills.
 */
import { mtof, osc, perc, noiseHit, noiseBuffer, makeLayers, setLayers, type Layers, type Rig } from '../rig'
import { release, type Held } from '../voices'
import type { Theme } from '../types'

const BPM = 96
const STEP = 60 / BPM / 4 // 16th note
const CHORDS = [
  { root: 45, pad: [57, 60, 64, 67, 71] }, // Am9
  { root: 41, pad: [53, 57, 60, 64, 67] }, // Fmaj9
  { root: 48, pad: [55, 59, 60, 64, 67] }, // Cmaj7
  { root: 43, pad: [55, 59, 62, 64, 67] }, // G6
]
/** Lead hook per chord: [step within the 2-bar chord, midi, length in 16ths] */
const HOOK: [number, number, number][][] = [
  [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 69, 4], [16, 72, 3], [19, 74, 3], [22, 76, 10]],
  [[0, 77, 6], [6, 76, 2], [8, 72, 8], [16, 69, 4], [20, 72, 4], [24, 74, 8]],
  [[0, 76, 6], [6, 79, 2], [8, 76, 4], [12, 74, 4], [16, 72, 8], [24, 71, 8]],
  [[0, 74, 6], [6, 71, 2], [8, 67, 8], [16, 69, 4], [20, 71, 4], [24, 74, 4], [28, 71, 4]],
]
const SCALE = [57, 60, 62, 64, 67] // A minor pentatonic
const ARP = [0, 2, 1, 3, 2, 4, 3, 1]

export function createPulse(): Theme {
  let padFilter: BiquadFilterNode | null = null
  let duck: GainNode | null = null
  let layers: Layers | null = null
  const voices: Held[] = []
  let step = 0
  let nextStep = 0
  let chordIdx = 0
  let chord = CHORDS[0]
  let key = 0
  let pendingKey = 0
  let lastLead = 0
  let drumLevel = 0

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
  }

  const pump = (t: number, depth: number) => {
    if (!duck || depth <= 0) return
    duck.gain.cancelScheduledValues(t)
    duck.gain.setValueAtTime(1, t)
    duck.gain.linearRampToValueAtTime(1 - 0.7 * depth, t + 0.01)
    duck.gain.setTargetAtTime(1, t + 0.04, 0.11)
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
    f.frequency.setValueAtTime(960 + energy * 1200, t)
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

  /** Mono synth lead with glide and delayed vibrato. */
  const lead = (rig: Rig, m: number, t: number, dur: number) => {
    const { ctx } = rig
    const f = mtof(m)
    const a = osc(ctx, 'sawtooth', f, -5)
    const b = osc(ctx, 'square', f, 5)
    if (lastLead && t - lastLead < 0.6) {
      ;[a, b].forEach((o) => {
        o.frequency.setValueAtTime(o.frequency.value * 0.94, t)
        o.frequency.exponentialRampToValueAtTime(f, t + 0.06)
      })
    }
    const lfo = osc(ctx, 'sine', 5.5)
    const vib = ctx.createGain()
    vib.gain.value = 0
    vib.gain.setValueAtTime(0, t + 0.25)
    vib.gain.linearRampToValueAtTime(12, t + 0.6)
    lfo.connect(vib)
    vib.connect(a.detune)
    vib.connect(b.detune)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 3
    lp.frequency.setValueAtTime(3800, t)
    lp.frequency.setTargetAtTime(1800, t + 0.02, 0.25)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.035, t + 0.012)
    g.gain.setTargetAtTime(0.026, t + 0.03, 0.2)
    g.gain.setTargetAtTime(0.0001, t + dur, 0.05)
    a.connect(lp)
    b.connect(lp)
    lp.connect(g).connect(rig.musicBus)
    g.connect(rig.delaySend)
    g.connect(rig.reverbSend)
    const end = t + dur + 0.4
    ;[a, b, lfo].forEach((o) => {
      o.start(t)
      o.stop(end)
    })
    lastLead = t + dur
  }

  const pad = (rig: Rig, t: number) => {
    const { ctx } = rig
    release(voices, t, 0.25)
    chord.pad.forEach((n) => {
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setTargetAtTime(0.024, t, 0.35)
      g.connect(padFilter!)
      const oscs = [-11, 11].map((d) => {
        const o = osc(ctx, 'sawtooth', mtof(n + key), d + Math.random() * 3)
        o.connect(g)
        o.start(t)
        return o
      })
      voices.push({ gain: g, oscs })
    })
  }

  const playStep = (t: number, energy: number) => {
    const R = layers!.rigs
    const s = step % 32
    const b = step % 16
    if (s === 0) {
      key = pendingKey
      chord = CHORDS[chordIdx % CHORDS.length]
      chordIdx++
      pad(R.pad, t)
    }
    const swing = b % 2 === 1 ? STEP * 0.12 : 0
    const tt = t + swing
    const moving = energy > 0.3

    // drums: half-time when calm, full groove when driving
    if (b === 0 || (moving && b === 8)) {
      kick(R.drums, t, 0.5 + energy * 0.25)
      pump(t, drumLevel)
    }
    if (energy > 0.55 && (b === 11 || (b === 14 && s >= 16))) kick(R.drums, t, 0.32 + energy * 0.2)
    if (b === 12 || (moving && b === 4)) clap(R.drums, t, 0.08 + energy * 0.08)
    // perc: hats
    if (b % 4 === 2) hat(R.perc, t, 0.045 + energy * 0.025, true, 0.25)
    else if (b % 4 === 0) hat(R.perc, t, 0.028, false, -0.2)
    else if (moving) hat(R.perc, tt, 0.018 + energy * 0.018, false, -0.35)

    // bass
    if ([0, 3, 6, 8, 11].includes(b)) bass(R.bass, chord.root + key, t, energy)
    if (b === 14) bass(R.bass, chord.root + key + 12, t, energy)

    // arpeggio (8ths when calm, 16ths + brighter when moving)
    if (b % 2 === 0 || moving) {
      const m = chord.pad[ARP[step % ARP.length]] + 12 + key
      synthPluck(R.arp, m, tt, 0.03 + energy * 0.03, R.arp.musicBus, 0.22, 2200 + energy * 4000)
    }

    // lead hook (every other pass of the progression it answers an octave lower)
    const phrase = HOOK[(chordIdx - 1 + CHORDS.length) % CHORDS.length]
    const pass = Math.floor((chordIdx - 1) / CHORDS.length) % 2
    for (const [at, m, len] of phrase) if (at === s) lead(R.lead, m + key - (pass ? 12 : 0), t, len * STEP * 0.95)
  }

  return {
    bpm: BPM,
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
    scene(_rig, sc, t) {
      if (layers) setLayers(layers, sc.layers, t)
      pendingKey = sc.key
      drumLevel = sc.layers.drums
    },
    start(rig, t) {
      const { ctx } = rig
      layers = makeLayers(rig, 0)
      padFilter = ctx.createBiquadFilter()
      padFilter.type = 'lowpass'
      padFilter.frequency.value = 900
      padFilter.Q.value = 1.2
      duck = ctx.createGain()
      padFilter.connect(duck)
      duck.connect(layers.rigs.pad.musicBus)
      duck.connect(layers.rigs.pad.reverbSend)
      step = 0
      chordIdx = 0
      nextStep = t + 0.05
    },
    tick(_rig, now, horizon, energy) {
      padFilter!.frequency.setTargetAtTime(1300 + energy * 3200, now, 0.2)
      while (horizon >= nextStep) {
        playStep(nextStep, energy)
        step++
        nextStep += STEP
      }
    },
    stop(_rig, t) {
      release(voices, t, 0.3)
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
        ;[76, 83].forEach((m, i) => synthPluck(rig, m + key, t + i * 0.05, 0.06, rig.sfxBus, 0.12, 5000))
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
        ;[69, 72, 76, 81, 84].forEach((m, i) => synthPluck(rig, m + key, t + i * 0.055, 0.07, rig.sfxBus, 0.3, 5200))
      },
      note(rig, t, i, vel) {
        const k = ((i % 13) + 13) % 13
        synthPluck(rig, SCALE[k % 5] + 12 * Math.floor(k / 5) + key, t, 0.08 * vel, rig.sfxBus, 0.4, 4600)
      },
      boot(rig, t) {
        const { ctx } = rig
        const o = osc(ctx, 'sine', 160)
        o.frequency.setValueAtTime(160, t)
        o.frequency.exponentialRampToValueAtTime(38, t + 1)
        const g = ctx.createGain()
        perc(g.gain, t, 0.4, 0.01, 1.2)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 1.3)
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
