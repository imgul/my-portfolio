/**
 * NIGHT SHIFT: lo-fi hip-hop for late-night building sessions. 80 BPM, F major, swung 16ths.
 * Fmaj9 → Em7 → Dm9 → Cmaj9 (one bar each).
 * Layers: pad = tape-wobbled Rhodes · bass = round sine bass · drums = dusty boom-bap
 * perc = swung hats + rim · arp = music-box bells · lead = a mellow whistle synth.
 */
import { mtof, osc, perc, noiseHit, noiseBuffer, makeLayers, setLayers, type Layers, type Rig } from '../rig'
import { bell, epiano, hat, kick, release, snare, type Held } from '../voices'
import type { Theme } from '../types'

const BPM = 80
const STEP = 60 / BPM / 4
const CHORDS = [
  { root: 41, keys: [57, 60, 64, 67] }, // Fmaj9 (A C E G)
  { root: 40, keys: [55, 59, 62, 64] }, // Em7
  { root: 38, keys: [57, 60, 64, 65] }, // Dm9 (A C E F)
  { root: 36, keys: [55, 59, 62, 64] }, // Cmaj9 (G B D E)
]
const PENTA = [60, 62, 64, 67, 69] // C major pentatonic
const LEAD = [64, 67, 69, 72, 74, 76, 79]
// Boom-bap pattern (16 steps)
const KICK = [1, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 1, 0, 0, 0, 0, 0]
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.25]

export function createLofi(): Theme {
  let layers: Layers | null = null
  let wobble: OscillatorNode | null = null
  let wobbleAmt: GainNode | null = null
  const voices: Held[] = []
  let step = 0
  let nextStep = 0
  let chord = CHORDS[0]
  let key = 0
  let pendingKey = 0
  let leadIdx = 3
  let leadBusy = 0

  const wobbleNode = () => wobbleAmt

  const whistle = (rig: Rig, m: number, t: number, dur: number) => {
    const { ctx } = rig
    const f = mtof(m)
    const a = osc(ctx, 'triangle', f)
    const b = osc(ctx, 'sine', f * 2)
    const lfo = osc(ctx, 'sine', 4.8)
    const vib = ctx.createGain()
    vib.gain.value = 0
    vib.gain.setValueAtTime(0, t + 0.2)
    vib.gain.linearRampToValueAtTime(16, t + 0.55)
    lfo.connect(vib)
    vib.connect(a.detune)
    vib.connect(b.detune)
    const bg = ctx.createGain()
    bg.gain.value = 0.15
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.045, t + 0.06)
    g.gain.setTargetAtTime(0.034, t + 0.08, 0.3)
    g.gain.setTargetAtTime(0.0001, t + dur, 0.09)
    a.connect(lp)
    b.connect(bg).connect(lp)
    lp.connect(g).connect(rig.musicBus)
    g.connect(rig.reverbSend)
    g.connect(rig.delaySend)
    const end = t + dur + 0.6
    ;[a, b, lfo].forEach((o) => {
      o.start(t)
      o.stop(end)
    })
  }

  const bass = (rig: Rig, m: number, t: number, len: number) => {
    const { ctx } = rig
    const o = osc(ctx, 'sine', mtof(m))
    const o2 = osc(ctx, 'triangle', mtof(m))
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.13, t + 0.015)
    g.gain.setTargetAtTime(0.08, t + 0.03, 0.2)
    g.gain.setTargetAtTime(0.0001, t + len, 0.05)
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(rig.musicBus)
    o.start(t)
    o2.start(t)
    o.stop(t + len + 0.4)
    o2.stop(t + len + 0.4)
  }

  const playStep = (t: number, energy: number) => {
    const R = layers!.rigs
    const b = step % 16
    const swing = b % 2 === 1 ? STEP * 0.22 : 0
    const tt = t + swing
    if (b === 0) {
      key = pendingKey
      chord = CHORDS[Math.floor(step / 16) % CHORDS.length]
      release(voices, t, 0.25)
      // lazy strum
      chord.keys.forEach((m, i) => voices.push(epiano(R.pad, m + key, t + i * 0.028, 0.95, R.pad.musicBus, { level: 0.05, wobble: wobbleNode(), hold: true })))
    }
    if (b === 10 && energy > 0.25) {
      chord.keys.slice(1).forEach((m, i) => epiano(R.pad, m + key + 12, tt + i * 0.02, 0.45, R.pad.musicBus, { level: 0.04, wobble: wobbleNode() }))
    }

    // bass: root on 1, a pickup and a fifth
    if (b === 0) bass(R.bass, chord.root + key, t, STEP * 6)
    if (b === 7) bass(R.bass, chord.root + key, tt, STEP * 2)
    if (b === 10) bass(R.bass, chord.root + key + 7, t, STEP * 4)
    if (b === 14 && energy > 0.4) bass(R.bass, chord.root + key + 12, t, STEP * 1.5)

    // boom-bap
    if (KICK[b]) kick(R.drums, b % 2 ? tt : t, (0.5 + energy * 0.15) * KICK[b], R.drums.musicBus, 110, 42, 0.36)
    if (energy > 0.55 && b === 13) kick(R.drums, tt, 0.3, R.drums.musicBus, 110, 42, 0.3)
    if (SNARE[b]) snare(R.drums, b % 2 ? tt : t, 0.14 * SNARE[b], R.drums.musicBus, 180, 1600)
    // hats + rim
    if (b % 2 === 0 || energy > 0.35) hat(R.perc, tt, b % 4 === 2 ? 0.04 : 0.024 + energy * 0.012, R.perc.musicBus, false, 0.2)
    if (b === 6 || b === 14) noiseHit(R.perc, tt, { type: 'bandpass', freq: 1800, q: 6, peak: 0.05, decay: 0.03, out: R.perc.musicBus, pan: -0.25 })

    // music box: sparse bells, busier when moving
    if (b % 4 === 3 && Math.random() < 0.35 + energy * 0.5) {
      const m = chord.keys[Math.floor(Math.random() * chord.keys.length)] + 24 + key
      bell(R.arp, m, tt, 0.03, R.arp.musicBus, 1.6, 3.5)
    }

    // whistle lead phrases
    if (t >= leadBusy && b % 2 === 0 && Math.random() < 0.12 + energy * 0.25) {
      leadIdx = Math.max(0, Math.min(LEAD.length - 1, leadIdx + [-2, -1, 1, 1, 2][Math.floor(Math.random() * 5)]))
      const len = [2, 3, 4, 4, 6, 8][Math.floor(Math.random() * 6)] * STEP
      whistle(R.lead, LEAD[leadIdx] + key, t, len * 0.9)
      leadBusy = t + len
    }
  }

  return {
    bpm: BPM,
    fx: {
      reverbSeconds: 2.8,
      reverbDecay: 2.6,
      reverbLevel: 0.5,
      delayTime: STEP * 3,
      delayFeedback: 0.32,
      delayTone: 1800,
      musicLevel: 0.75,
      sfxLevel: 0.72,
    },
    scene(_rig, sc, t) {
      if (layers) setLayers(layers, sc.layers, t)
      pendingKey = sc.key
    },
    start(rig, t) {
      const { ctx } = rig
      layers = makeLayers(rig, 0)
      wobble = osc(ctx, 'sine', 0.45)
      wobbleAmt = ctx.createGain()
      wobbleAmt.gain.value = 9
      wobble.connect(wobbleAmt)
      wobble.start(t)
      step = 0
      nextStep = t + 0.05
      leadBusy = t + 4
    },
    tick(_rig, _now, horizon, energy) {
      while (horizon >= nextStep) {
        playStep(nextStep, energy)
        step++
        nextStep += STEP
      }
    },
    stop(_rig, t) {
      release(voices, t, 0.3)
      wobble?.stop(t + 2)
    },
    sfx: {
      hover(rig, t) {
        const { ctx } = rig
        const o = osc(ctx, 'sine', 1100)
        o.frequency.setValueAtTime(1300, t)
        o.frequency.exponentialRampToValueAtTime(900, t + 0.03)
        const g = ctx.createGain()
        perc(g.gain, t, 0.04, 0.001, 0.03)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 0.05)
      },
      click(rig, t) {
        epiano(rig, 72 + key, t, 0.8, rig.sfxBus, { level: 0.08 })
        epiano(rig, 79 + key, t + 0.05, 0.6, rig.sfxBus, { level: 0.06 })
      },
      whoosh(rig, t, strength) {
        // tape rewind: a fast rising, wobbling squeal under a noise swell
        const { ctx } = rig
        const dur = 0.7
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx)
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.Q.value = 1.6
        f.frequency.setValueAtTime(400, t)
        f.frequency.exponentialRampToValueAtTime(3500, t + dur)
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.08 * strength, t + dur * 0.85)
        g.gain.linearRampToValueAtTime(0, t + dur + 0.04)
        src.connect(f).connect(g).connect(rig.sfxBus)
        src.start(t, Math.random(), dur + 0.1)
        const sq = osc(ctx, 'triangle', 300)
        sq.frequency.setValueAtTime(300, t)
        sq.frequency.exponentialRampToValueAtTime(2600, t + dur)
        const sg = ctx.createGain()
        sg.gain.value = 0
        sg.gain.setValueAtTime(0, t)
        sg.gain.linearRampToValueAtTime(0.012 * strength, t + dur * 0.8)
        sg.gain.linearRampToValueAtTime(0, t + dur)
        sq.connect(sg).connect(rig.sfxBus)
        sq.start(t)
        sq.stop(t + dur + 0.05)
        noiseHit(rig, t + dur, { type: 'lowpass', freq: 400, peak: 0.12 * strength, decay: 0.08, out: rig.sfxBus })
      },
      success(rig, t) {
        ;[65, 69, 72, 76, 79, 84].forEach((m, i) => epiano(rig, m + key, t + i * 0.06, 0.7, rig.sfxBus, { level: 0.06 }))
      },
      note(rig, t, i, vel) {
        const k = ((i % 15) + 15) % 15
        bell(rig, PENTA[k % 5] + 12 * Math.floor(k / 5) + key, t, 0.07 * vel, rig.sfxBus, 1.4, 3.5)
      },
      boot(rig, t) {
        // needle drop + a tape machine spinning up into the first chord
        const { ctx } = rig
        noiseHit(rig, t, { type: 'lowpass', freq: 300, peak: 0.25, decay: 0.12, out: rig.sfxBus })
        noiseHit(rig, t + 0.01, { type: 'highpass', freq: 3000, peak: 0.06, decay: 0.04, out: rig.sfxBus })
        CHORDS[0].keys.forEach((m, i) => {
          const s = t + 0.15 + i * 0.03
          const o = osc(ctx, 'triangle', mtof(m) * 0.4)
          o.frequency.setValueAtTime(mtof(m) * 0.4, s)
          o.frequency.exponentialRampToValueAtTime(mtof(m), s + 0.5)
          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 1800
          const g = ctx.createGain()
          perc(g.gain, s, 0.05, 0.25, 1.6)
          o.connect(lp).connect(g).connect(rig.sfxBus)
          g.connect(rig.reverbSend)
          o.start(s)
          o.stop(s + 2)
        })
        bell(rig, 84, t + 0.8, 0.04, rig.sfxBus, 1.8)
      },
    },
  }
}
