/**
 * SOUNDTRACK: every section has its own piece of music, matched to its 3D
 * shape and content. Scrolling into a section crossfades to its piece
 * (~3 s), so the music follows you down the page. Calm throughout: no drums,
 * no noise beds, nothing that competes with reading.
 *
 *  0 Intro      galaxy     "Interstellar"    pipe organ + a slow ticking clock, A minor
 *  1 Manifesto  DNA        "Conviction"      bowed strings over a pizzicato heartbeat, D minor
 *  2 Journey    road       "Open Road"       fingerpicked acoustic guitar, G major
 *  3 Ventures   city       "City Lights"     minimalist marimba cell, F lydian
 *  4 Notes      book       "Pages"           solo felt piano, rubato
 *  5 Stack      layers     "Clockwork"       two kalimbas in 4-against-3, E minor
 *  6 Agents     neural net "Many Minds"      three voices (bell, kalimba, piano) looping
 *                                            phrases of different lengths, D dorian
 *  7 Learning   tree       "Study Hall"      Bach-style prelude on piano + cello (classic study music)
 *  8 Beyond     mountains  "Margalla Trail"  nature: birdsong, breeze, a mountain stream,
 *                                            a wooden flute and a soft drone
 *  9 Contact    globe      "Homecoming"      warm piano arpeggios + strings, D major
 */
import { Ambience } from '../ambience'
import { feltPiano, organ, strings, drone, pluck, mallet, flute, tock } from '../instruments'
import { mtof, noiseBuffer, osc, perc, type Rig } from '../rig'
import { SCENES } from '../scenes'
import { bell, release, type Held } from '../voices'
import type { Theme } from '../types'

interface Env {
  ambience: Ambience | null
}

/** A piece = a little step sequencer with its own instruments. */
class Piece {
  /** current chord voices (released on chord change) */
  voices: Held[] = []
  /** long-lived voices (released when the piece ends) */
  drones: Held[] = []
  private next = 0
  private s = 0
  private readonly step: number
  private readonly onStep: (p: Piece, r: Rig, s: number, t: number) => void
  onStart?: (p: Piece, r: Rig, t: number) => void
  onStop?: (p: Piece, t: number) => void
  readonly scale: number[]
  readonly level: number

  constructor(o: {
    step: number
    scale: number[]
    level?: number
    onStep: (p: Piece, r: Rig, s: number, t: number) => void
    onStart?: (p: Piece, r: Rig, t: number) => void
    onStop?: (p: Piece, t: number) => void
  }) {
    this.step = o.step
    this.scale = o.scale
    this.level = o.level ?? 1
    this.onStep = o.onStep
    this.onStart = o.onStart
    this.onStop = o.onStop
  }

  start(r: Rig, t: number) {
    this.next = t + 0.05
    this.s = 0
    this.onStart?.(this, r, t)
  }

  tick(r: Rig, horizon: number) {
    while (horizon >= this.next) {
      this.onStep(this, r, this.s, this.next)
      this.s++
      this.next += this.step
    }
  }

  chord(t: number, tau = 1.4) {
    release(this.voices, t, tau)
  }

  stop(t: number) {
    release(this.voices, t, 1.1)
    release(this.drones, t, 1.1)
    this.onStop?.(this, t)
  }
}

const hum = () => Math.random() * 0.012 // tiny human timing

/* ---------------------------------------------------------------- 0 Galaxy */
const INTERSTELLAR = [
  { organ: [45, 52, 57, 60, 64], mel: [69, 71, 72, 71] }, // Am
  { organ: [41, 53, 57, 60, 64], mel: [69, 72, 76, 72] }, // Fmaj7
  { organ: [48, 55, 60, 64, 67], mel: [67, 72, 76, 72] }, // C
  { organ: [43, 50, 59, 62, 67], mel: [67, 71, 74, 71] }, // G
]
const interstellar = () =>
  new Piece({
    level: 1.35,
    step: 0.42,
    scale: [57, 60, 62, 64, 67, 69, 72, 74],
    onStep(p, r, s, t) {
      const c = INTERSTELLAR[Math.floor(s / 16) % 4]
      if (s % 16 === 0) {
        p.chord(t, 1.6)
        c.organ.forEach((m, k) => p.voices.push(organ(r, m, t, k === 0 ? 0.016 : 0.0085, 1.1)))
      }
      // the ostinato enters after the first chord: a pedal E alternating with a slow melody
      if (s >= 16) {
        const k = s % 8
        const m = k % 2 === 0 ? 76 : c.mel[(k >> 1) % 4] + 12
        mallet(r, m, t, k % 2 === 0 ? 0.55 : 0.8, { ratio: 2, partial: 0.35, decay: 1, level: 0.016 })
      }
      // the clock: one soft tick every ~1.26 s
      if (s % 3 === 0) tock(r, t, 0.012, s % 6 === 0)
    },
  })

/* ------------------------------------------------------------------- 1 DNA */
const CONVICTION = [
  { root: 38, pad: [50, 57, 62, 65], top: 69 }, // Dm
  { root: 34, pad: [46, 53, 62, 65], top: 70 }, // Bb
  { root: 41, pad: [48, 57, 60, 65], top: 72 }, // F
  { root: 36, pad: [48, 55, 64, 67], top: 67 }, // C
]
const conviction = () =>
  new Piece({
    level: 1.1,
    step: 0.5,
    scale: [62, 65, 67, 69, 72, 74, 77, 79],
    onStep(p, r, s, t) {
      const c = CONVICTION[Math.floor(s / 16) % 4]
      if (s % 16 === 0) {
        p.chord(t, 1.2)
        c.pad.forEach((m) => p.voices.push(strings(r, m, t, 0.0075, { bright: 1100, attack: 0.9 })))
        p.voices.push(drone(r, c.root, t, 0.035))
      }
      // a high violin line swells in halfway through each chord
      if (s % 16 === 8 && s >= 16) p.voices.push(strings(r, c.top + 12, t, 0.004, { bright: 2200, attack: 1.3 }))
      // pizzicato heartbeat: root, then fifth
      if (s % 4 === 0) pluck(r, c.root + 12, t + hum(), 0.85, { loss: 0.986, soft: 0.75, level: 0.11, tone: 1800 })
      if (s % 4 === 2) pluck(r, c.root + 19, t + hum(), 0.5, { loss: 0.986, soft: 0.75, level: 0.1, tone: 1800 })
    },
  })

/* ------------------------------------------------------------------ 2 Road */
const ROAD = [
  { b: 43, a: 50, u: [59, 62, 67] }, // G
  { b: 40, a: 47, u: [55, 59, 64] }, // Em
  { b: 48, a: 43, u: [55, 60, 64] }, // C
  { b: 50, a: 45, u: [57, 62, 66] }, // D
]
const openRoad = () =>
  new Piece({
    level: 1.3,
    step: 0.36,
    scale: [55, 57, 59, 62, 64, 67, 69, 71],
    onStep(p, r, s, t) {
      const c = ROAD[Math.floor(s / 16) % 4]
      if (s % 16 === 0) {
        p.chord(t, 1)
        c.u.forEach((m) => p.voices.push(strings(r, m, t, 0.0028, { bright: 900, attack: 1.4 })))
      }
      // Travis picking: alternating bass under a rolling treble
      const k = s % 8
      const pat: number[][] = [[c.b, c.u[2]], [c.u[0]], [c.a], [c.u[1]], [c.b], [c.u[2]], [c.a], [c.u[0]]]
      pat[k].forEach((m, j) => {
        const bass = m < 52
        pluck(r, m, t + hum() + j * 0.006, bass ? 0.8 : 0.55 + Math.random() * 0.15, { level: bass ? 0.1 : 0.075, soft: 0.45, pan: bass ? -0.12 : 0.15 })
      })
      // a little melodic hammer-on near the end of each chord
      if (s % 16 === 13 && s >= 16) pluck(r, c.u[2] + 12, t + hum(), 0.45, { level: 0.07, soft: 0.3 })
    },
  })

/* ------------------------------------------------------------------ 3 City */
const CITY = [
  { root: 41, t: [60, 65, 69, 72, 76] }, // Fmaj7
  { root: 45, t: [60, 64, 69, 72, 76] }, // Am7
  { root: 38, t: [62, 65, 69, 72, 76] }, // Dm9
  { root: 46, t: [58, 62, 65, 69, 76] }, // Bbmaj7#11
]
const CELL = [0, 2, 4, 1, 3, 2]
const cityLights = () =>
  new Piece({
    level: 1.35,
    step: 0.33,
    scale: [60, 62, 65, 67, 69, 72, 74, 77],
    onStep(p, r, s, t) {
      const c = CITY[Math.floor(s / 16) % 4]
      if (s % 16 === 0) {
        p.chord(t, 1.2)
        p.voices.push(drone(r, c.root, t, 0.03))
        p.voices.push(drone(r, c.root + 7, t, 0.012, 'triangle'))
      }
      // a six-note cell over an eight-step bar slowly shifts against the beat
      mallet(r, c.t[CELL[s % 6]], t + hum(), s % 2 === 0 ? 0.7 : 0.5, { ratio: 3.93, partial: 0.28, decay: 1.1, level: 0.042, pan: 0.2 })
      if (s % 4 === 0) mallet(r, c.t[0] - 12, t, 0.6, { ratio: 3.93, partial: 0.2, decay: 1.4, level: 0.045, pan: -0.2 })
      // a distant light now and then
      if (s % 32 === 24) bell(r, c.t[4] + 12, t, 0.008, r.musicBus, 3, 3.5)
    },
  })

/* ------------------------------------------------------------------ 4 Book */
const PAGES = [
  { b: 48, c: [55, 59, 64], mel: [72, 76, 79, 74] }, // Cmaj7
  { b: 45, c: [52, 57, 60], mel: [72, 76, 69, 74] }, // Am
  { b: 41, c: [53, 57, 64], mel: [72, 69, 77, 76] }, // Fmaj7
  { b: 43, c: [50, 55, 59], mel: [74, 71, 79, 67] }, // G
]
const pages = () =>
  new Piece({
    level: 1.5,
    step: 0.5,
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
    onStep(_p, r, s, t) {
      const c = PAGES[Math.floor(s / 12) % 4]
      const k = s % 12
      if (k === 0) {
        feltPiano(r, c.b, t, 0.65, { level: 0.065, decay: 4.5 })
        c.c.forEach((m, j) => feltPiano(r, m, t + 0.08 * (j + 1) + hum(), 0.5, { level: 0.055, decay: 4 }))
      }
      if (k === 3) feltPiano(r, c.mel[0], t + hum() * 4, 0.6, { level: 0.06 })
      if (k === 6) feltPiano(r, c.mel[1], t + hum() * 4, 0.55, { level: 0.06 })
      if (k === 9 && Math.random() < 0.75) feltPiano(r, c.mel[2], t + hum() * 4, 0.5, { level: 0.06 })
      if (k === 11 && Math.random() < 0.4) feltPiano(r, c.mel[3], t, 0.42, { level: 0.06 })
    },
  })

/* ----------------------------------------------------------------- 5 Stack */
const CLOCKWORK = [
  { root: 40, a: [64, 67, 71, 78], b: [52, 59, 66] }, // Em9
  { root: 36, a: [64, 67, 71, 76], b: [48, 55, 59] }, // Cmaj7
  { root: 43, a: [62, 67, 71, 74], b: [50, 55, 59] }, // G
  { root: 38, a: [62, 66, 69, 74], b: [50, 57, 62] }, // D
]
const clockwork = () =>
  new Piece({
    level: 1.45,
    step: 0.3,
    scale: [64, 67, 69, 71, 74, 76, 79, 81],
    onStep(p, r, s, t) {
      const c = CLOCKWORK[Math.floor(s / 16) % 4]
      if (s % 16 === 0) {
        p.chord(t, 1)
        p.voices.push(drone(r, c.root, t, 0.03))
      }
      // gear A turns in fours, gear B in threes: they mesh every 12 steps
      if (s % 4 !== 3) mallet(r, c.a[s % 4], t + hum(), 0.55, { ratio: 5.4, partial: 0.2, decay: 1.5, level: 0.036, pan: 0.25 })
      if (s % 3 === 0) mallet(r, c.b[Math.floor(s / 3) % 3], t + hum(), 0.65, { ratio: 5.4, partial: 0.18, decay: 1.8, level: 0.042, pan: -0.25 })
    },
  })

/* ---------------------------------------------------------------- 6 Agents */
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const deg = (d: number, base = 62) => base + DORIAN[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7)
const manyMinds = () =>
  new Piece({
    level: 2,
    step: 0.45,
    scale: [62, 64, 65, 69, 71, 74, 76, 77],
    onStep(p, r, s, t) {
      if (s % 16 === 0) {
        p.chord(t, 1.6)
        const pad = Math.floor(s / 16) % 2 === 0 ? [50, 57, 64, 65] : [50, 59, 62, 67] // Dm9 ↔ G/D
        pad.forEach((m) => p.voices.push(strings(r, m, t, 0.0045, { bright: 850, attack: 1.4 })))
      }
      // agent A (bell) loops every 8 steps
      if (s % 2 === 0) bell(r, deg([0, 2, 4, 7][(s % 8) / 2]) + 12, t + hum(), 0.0075, r.musicBus, 2.2, 3.5)
      // agent B (kalimba) joins on step 8, loops every 10
      if (s >= 8 && s % 2 === 1) mallet(r, deg([4, 3, 2, 1, 2][((s % 10) - 1) / 2]), t + hum(), 0.6, { ratio: 5.4, partial: 0.2, decay: 1.4, level: 0.036, pan: -0.3 })
      // agent C (piano) joins on step 16, loops every 12
      if (s >= 16 && s % 4 === 0) feltPiano(r, deg([7, 6, 4][(s % 12) / 4]), t + hum(), 0.5, { level: 0.05 })
    },
  })

/* -------------------------------------------------------------- 7 Learning */
// Bach, Prelude in C (BWV 846), the classic study piece: five notes per bar,
// played as 1-2-3-4-5-3-4-5 twice.
const PRELUDE = [
  [60, 64, 67, 72, 76],
  [60, 62, 69, 74, 77],
  [59, 62, 67, 74, 77],
  [60, 64, 67, 72, 76],
  [60, 64, 69, 76, 81],
  [60, 62, 66, 69, 74],
  [59, 62, 67, 74, 79],
  [59, 60, 64, 67, 72],
  [57, 60, 64, 67, 72],
  [50, 57, 62, 66, 72],
  [55, 59, 62, 67, 71],
  [53, 57, 62, 69, 74],
  [52, 55, 60, 67, 72],
  [52, 53, 57, 60, 65],
  [50, 53, 57, 60, 65],
  [43, 50, 55, 59, 65],
  [48, 52, 55, 60, 64],
]
const FIGURE = [0, 1, 2, 3, 4, 2, 3, 4]
const studyHall = () =>
  new Piece({
    level: 1.2,
    step: 0.26,
    scale: [60, 62, 64, 65, 67, 69, 71, 72],
    onStep(p, r, s, t) {
      const bar = PRELUDE[Math.floor(s / 16) % PRELUDE.length]
      const k = s % 8
      if (s % 16 === 0) {
        p.chord(t, 1.2)
        p.voices.push(strings(r, bar[0] - 12, t, 0.0055, { bright: 800, attack: 0.8 }))
      }
      const n = bar[FIGURE[k]]
      feltPiano(r, n, t + hum() * 0.5, k === 0 ? 0.6 : k === 1 ? 0.5 : 0.42, { level: 0.05, decay: k < 2 ? 4 : 2.6 })
    },
  })

/* ----------------------------------------------------------------- 8 Trail */
const streamCache = new WeakMap<BaseAudioContext, AudioBuffer>()
/** 6 s of babbling water: soft pink-ish noise with random bubbling. */
function streamBuffer(ctx: BaseAudioContext) {
  let b = streamCache.get(ctx)
  if (b) return b
  const len = ctx.sampleRate * 6
  b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let env = 0.5
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.997 * b0 + w * 0.029
      b1 = 0.985 * b1 + w * 0.032
      b2 = 0.95 * b2 + w * 0.048
      // slow random swells, like water over stones
      if (i % 64 === 0) env += (Math.random() - 0.5) * 0.08
      env = Math.max(0.25, Math.min(1, env))
      d[i] = (b0 + b1 + b2 + w * 0.02) * env
    }
    // crossfade the loop seam
    const fade = ctx.sampleRate * 0.25
    for (let i = 0; i < fade; i++) {
      const a = i / fade
      d[i] = d[i] * a + d[len - fade + i] * (1 - a)
    }
  }
  streamCache.set(ctx, b)
  return b
}

const TRAIL_FLUTE = [69, 71, 74, 76, 78, 81]
const trail = (env: Env) => {
  let water: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  let nextPhrase = 0
  let nextHarmonic = 0
  return new Piece({
    step: 0.25,
    level: 0.85,
    scale: [62, 64, 66, 69, 71, 74, 76, 78],
    onStart(p, r, t) {
      const { ctx } = r
      env.ambience?.set({ air: 0.45, birds: 0.75 }, t)
      const src = ctx.createBufferSource()
      src.buffer = streamBuffer(ctx)
      src.loop = true
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 380
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2600
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.gain.setTargetAtTime(0.065, t, 1.5)
      const pan = ctx.createStereoPanner()
      pan.pan.value = -0.35
      src.connect(hp).connect(lp).connect(gain).connect(pan).connect(r.musicBus)
      src.start(t, Math.random() * 5)
      water = { src, gain }
      // the valley drone: D and A, barely there
      p.drones.push(drone(r, 50, t, 0.02))
      p.drones.push(strings(r, 57, t, 0.0032, { bright: 650, attack: 2 }))
      p.drones.push(strings(r, 62, t, 0.0024, { bright: 650, attack: 2.5 }))
      nextPhrase = t + 2.5
      nextHarmonic = t + 5
    },
    onStep(_p, r, _s, t) {
      if (t >= nextPhrase) {
        // a short wooden-flute phrase across the valley
        let at = t
        let i = Math.floor(Math.random() * 3) + 1
        const n = 3 + Math.floor(Math.random() * 3)
        for (let k = 0; k < n; k++) {
          const last = k === n - 1
          const dur = last ? 1.3 + Math.random() * 0.6 : 0.35 + Math.random() * 0.45
          flute(r, TRAIL_FLUTE[i], at, dur, last ? 0.75 : 0.9, 0.032)
          at += dur + 0.06
          i = Math.max(0, Math.min(TRAIL_FLUTE.length - 1, i + (Math.random() < 0.55 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2)))
        }
        nextPhrase = at + 6 + Math.random() * 6
      }
      if (t >= nextHarmonic) {
        // a guitar harmonic rings out
        pluck(r, [74, 78, 81, 86][Math.floor(Math.random() * 4)], t, 0.5, { loss: 0.998, soft: 0.15, level: 0.05, pan: 0.3 })
        nextHarmonic = t + 4 + Math.random() * 5
      }
    },
    onStop(_p, t) {
      env.ambience?.set({}, t)
      if (water) {
        water.gain.gain.cancelScheduledValues(t)
        water.gain.gain.setTargetAtTime(0, t, 0.9)
        water.src.stop(t + 6)
        water = null
      }
    },
  })
}

/* ---------------------------------------------------------------- 9 Globe */
const HOME = [
  { b: 38, arp: [50, 57, 62, 66, 69, 66, 62, 57], pad: [62, 66, 69], top: 78 }, // D
  { b: 37, arp: [49, 57, 61, 64, 69, 64, 61, 57], pad: [61, 64, 69], top: 76 }, // A/C#
  { b: 35, arp: [47, 54, 59, 62, 66, 62, 59, 54], pad: [62, 66, 71], top: 74 }, // Bm
  { b: 31, arp: [43, 50, 55, 59, 62, 59, 55, 50], pad: [59, 62, 67], top: 74 }, // G
]
const homecoming = () =>
  new Piece({
    level: 1.0,
    step: 0.42,
    scale: [62, 64, 66, 69, 71, 74, 76, 78],
    onStep(p, r, s, t) {
      const c = HOME[Math.floor(s / 16) % 4]
      if (s % 16 === 0) {
        p.chord(t, 1.2)
        c.pad.forEach((m) => p.voices.push(strings(r, m, t, 0.0042, { bright: 1300, attack: 1.1 })))
        p.voices.push(drone(r, c.b + 12, t, 0.03))
      }
      const k = s % 8
      feltPiano(r, c.arp[k], t + hum(), k === 0 ? 0.6 : 0.42, { level: 0.05 })
      if (s % 16 === 4 && s >= 16) feltPiano(r, c.top, t + hum(), 0.55, { level: 0.055 })
    },
  })

/* ------------------------------------------------------------------ theme */

const PIECES: { title: string; make: (env: Env) => Piece }[] = [
  { title: 'Interstellar', make: interstellar },
  { title: 'Conviction', make: conviction },
  { title: 'Open Road', make: openRoad },
  { title: 'City Lights', make: cityLights },
  { title: 'Pages', make: pages },
  { title: 'Clockwork', make: clockwork },
  { title: 'Many Minds', make: manyMinds },
  { title: 'Study Hall', make: studyHall },
  { title: 'Margalla Trail', make: trail },
  { title: 'Homecoming', make: homecoming },
]

/** Track title per section, for the "now playing" chip. */
export const SOUNDTRACK_TITLES = PIECES.map((p) => p.title)

export function createSoundtrack(): Theme {
  const env: Env = { ambience: null }
  let cur: { piece: Piece; rig: Rig; gates: GainNode[] } | null = null
  let curIndex = -1
  let pending = 0
  let started = false

  /** Crossfade to section i's piece. */
  const switchTo = (rig: Rig, i: number, t: number) => {
    if (i === curIndex && cur) return
    if (cur) {
      cur.piece.stop(t)
      for (const g of cur.gates) {
        g.gain.cancelScheduledValues(t)
        g.gain.setTargetAtTime(0, t, 0.9)
      }
    }
    const def = PIECES[i] ?? PIECES[0]
    const piece = def.make(env)
    const { ctx } = rig
    const gate = (dest: AudioNode) => {
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setTargetAtTime(piece.level, t, 1.1)
      g.connect(dest)
      return g
    }
    const gates = [gate(rig.musicBus), gate(rig.reverbSend), gate(rig.delaySend)]
    const proxy: Rig = { ...rig, musicBus: gates[0], reverbSend: gates[1], delaySend: gates[2] }
    piece.start(proxy, t)
    cur = { piece, rig: proxy, gates }
    curIndex = i
  }

  const scale = () => cur?.piece.scale ?? [62, 64, 66, 69, 71, 74, 76, 78]

  return {
    bpm: 60,
    ambience: 0,
    stingers: false,
    fx: {
      reverbSeconds: 4.5,
      reverbDecay: 2.6,
      reverbLevel: 0.6,
      delayTime: 0.63,
      delayFeedback: 0.25,
      delayTone: 1800,
      musicLevel: 0.9,
      sfxLevel: 0.45,
    },
    scene(rig, sc, t) {
      const i = Math.max(0, SCENES.indexOf(sc))
      if (started) switchTo(rig, i, t)
      else pending = i
    },
    start(rig, t) {
      started = true
      env.ambience = new Ambience(rig)
      env.ambience.start(t, 60, t)
      switchTo(rig, pending, t)
    },
    tick(_rig, now, horizon) {
      if (cur) cur.piece.tick(cur.rig, horizon)
      env.ambience?.tick(now, horizon)
    },
    stop(_rig, t) {
      if (cur) {
        cur.piece.stop(t)
        for (const g of cur.gates) g.gain.setTargetAtTime(0, t, 0.5)
      }
      cur = null
      curIndex = -1
      env.ambience?.stop(t)
      env.ambience = null
      started = false
    },
    sfx: {
      hover(rig, t) {
        const { ctx } = rig
        const o = osc(ctx, 'sine', 1180)
        const g = ctx.createGain()
        perc(g.gain, t, 0.012, 0.004, 0.05)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 0.08)
      },
      click(rig, t) {
        feltPiano(rig, scale()[5], t, 0.6, { out: rig.sfxBus, level: 0.07 })
      },
      whoosh(rig, t, strength) {
        // a soft breath of air, no sweep
        const { ctx } = rig
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900
        bp.Q.value = 0.8
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.006 * strength, t + 0.5)
        g.gain.linearRampToValueAtTime(0, t + 1.4)
        src.connect(bp).connect(g).connect(rig.sfxBus)
        src.start(t, Math.random(), 1.5)
      },
      success(rig, t) {
        const sc = scale()
        ;[sc[2], sc[4], sc[7]].forEach((m, i) => feltPiano(rig, m, t + i * 0.12, 0.7, { out: rig.sfxBus, level: 0.07 }))
      },
      note(rig, t, i, vel) {
        const sc = scale()
        const k = ((i % 16) + 16) % 16
        const m = sc[k % sc.length] + 12 * Math.floor(k / sc.length) - 12
        feltPiano(rig, m, t, 0.75 * vel, { out: rig.sfxBus, level: 0.07 })
      },
      boot(rig, t) {
        feltPiano(rig, 45, t + 0.2, 0.7, { out: rig.sfxBus, level: 0.07, decay: 4 })
        feltPiano(rig, 64, t + 0.9, 0.5, { out: rig.sfxBus, level: 0.07 })
        // a hint of the Interstellar clock
        ;[1.6, 2.86].forEach((d) => {
          const o = osc(rig.ctx, 'sine', mtof(84))
          const g = rig.ctx.createGain()
          perc(g.gain, t + d, 0.006, 0.002, 0.05)
          o.connect(g).connect(rig.sfxBus)
          o.start(t + d)
          o.stop(t + d + 0.1)
        })
      },
    },
  }
}
