/**
 * DEEP FOCUS: music made to read to. No drums, no noise, no arpeggios, no build-ups.
 *  - a warm, slowly breathing pad (sine + soft triangle, low-passed around 1 kHz)
 *  - a quiet sub that follows the chord root
 *  - an occasional felt-piano note, far apart and never on a grid
 *  - a faint high "air" shimmer in a few sections
 * Chords change every ~14 s with long crossfades (Dmaj9 → Bm11 → Gmaj9 → Asus2).
 * Sections only shift the colour: key, warmth and how often the piano speaks.
 * Scrolling does not make it louder or busier.
 */
import { mtof, osc, perc, makeLayers, setLayers, type Layers, type Rig } from '../rig'
import { release, type Held } from '../voices'
import type { Theme } from '../types'

const CHORDS = [
  [50, 57, 61, 64, 66], // Dmaj9
  [47, 54, 57, 61, 64], // Bm11
  [43, 50, 54, 57, 62], // Gmaj9
  [45, 52, 57, 59, 64], // Asus2
]
const PIANO = [62, 64, 66, 69, 71, 74, 76, 78] // D major pentatonic + colour tones
const CHORD_SECONDS = 14

export function createFocus(): Theme {
  let layers: Layers | null = null
  let padFilter: BiquadFilterNode | null = null
  let lfo: OscillatorNode | null = null
  const pad: Held[] = []
  const air: Held[] = []
  let chordIdx = 0
  let nextChord = 0
  let nextNote = 0
  let key = 0
  let pendingKey = 0
  let pianoRate = 1
  let lastNote = -1

  /** Felt piano: soft hammer, warm tone, long natural decay. */
  const piano = (rig: Rig, m: number, t: number, vel: number, out: AudioNode) => {
    const { ctx } = rig
    const f = mtof(m)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900 + vel * 900
    lp.Q.value = 0.3
    const g = ctx.createGain()
    perc(g.gain, t, 0.06 * vel, 0.012, 3.2)
    ;[
      [1, 1],
      [2, 0.18],
      [3.01, 0.05],
    ].forEach(([r, a]) => {
      const o = osc(ctx, 'sine', f * r, Math.random() * 4 - 2)
      const og = ctx.createGain()
      og.gain.value = a
      o.connect(og).connect(lp)
      o.start(t)
      o.stop(t + 3.4)
    })
    lp.connect(g).connect(out)
    g.connect(rig.reverbSend)
  }

  const playChord = (t: number) => {
    const R = layers!.rigs
    const { ctx } = R.pad
    key = pendingKey
    const chord = CHORDS[chordIdx % CHORDS.length].map((n) => n + key)
    chordIdx++
    release(pad, t, 2.2)
    release(air, t, 2.5)
    chord.forEach((m, i) => {
      const root = i === 0
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setTargetAtTime(root ? 0.075 : 0.022, t, 2.6)
      g.connect(root ? R.bass.musicBus : padFilter!)
      const oscs = (root ? (['sine'] as OscillatorType[]) : (['sine', 'triangle'] as OscillatorType[])).map((type, k) => {
        const o = osc(ctx, type, mtof(root ? m - 12 : m), root ? 0 : (k ? 5 : -5) + Math.random() * 3)
        o.connect(g)
        o.start(t)
        return o
      })
      pad.push({ gain: g, oscs })
    })
    // airy shimmer: the 9th two octaves up, almost subliminal
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setTargetAtTime(0.006, t + 2, 4)
    const trem = osc(ctx, 'sine', 0.15)
    const tg = ctx.createGain()
    tg.gain.value = 0.004
    trem.connect(tg).connect(g.gain)
    const o = osc(ctx, 'sine', mtof(chord[4] + 12))
    o.connect(g).connect(R.lead.musicBus)
    g.connect(R.lead.reverbSend)
    o.start(t)
    trem.start(t)
    air.push({ gain: g, oscs: [o, trem] })
  }

  return {
    bpm: 60,
    ambience: 0,
    stingers: false,
    fx: {
      reverbSeconds: 5,
      reverbDecay: 2.4,
      reverbLevel: 0.7,
      delayTime: 0.9,
      delayFeedback: 0.2,
      delayTone: 1400,
      musicLevel: 0.55,
      sfxLevel: 0.45,
    },
    scene(_rig, sc, t) {
      if (layers) {
        setLayers(
          layers,
          { pad: 1, bass: 0.6 + sc.layers.bass * 0.4, drums: 0, perc: 0, arp: 1, lead: sc.layers.lead > 0.5 ? 1 : 0.35 },
          t,
          3,
        )
      }
      // Keep the colour shifts gentle: map every scene to a close, consonant key.
      const k = [0, 2, -3, -5, 5].includes(sc.key) ? sc.key : 0
      if (k !== pendingKey) {
        pendingKey = k
        nextChord = Math.min(nextChord, t + 2)
      }
      // the piano speaks a little more in reflective sections, less in busy ones
      pianoRate = sc.drive > 0.5 ? 0.7 : sc.drive < 0.1 ? 1.25 : 1
      if (padFilter) padFilter.frequency.setTargetAtTime(700 + sc.bright * 600, t, 3)
    },
    start(rig, t) {
      const { ctx } = rig
      layers = makeLayers(rig, 0)
      padFilter = ctx.createBiquadFilter()
      padFilter.type = 'lowpass'
      padFilter.frequency.value = 1000
      padFilter.Q.value = 0.4
      lfo = osc(ctx, 'sine', 0.035)
      const lg = ctx.createGain()
      lg.gain.value = 180
      lfo.connect(lg).connect(padFilter.frequency)
      lfo.start(t)
      padFilter.connect(layers.rigs.pad.musicBus)
      padFilter.connect(layers.rigs.pad.reverbSend)
      chordIdx = 0
      nextChord = t + 0.1
      nextNote = t + 4
    },
    tick(_rig, _now, horizon) {
      const R = layers!.rigs
      while (horizon >= nextChord) {
        playChord(nextChord)
        nextChord += CHORD_SECONDS
      }
      while (horizon >= nextNote) {
        const chord = CHORDS[(chordIdx + CHORDS.length - 1) % CHORDS.length]
        const pool = [...PIANO, chord[2] + 12, chord[3] + 12]
        let i = Math.floor(Math.random() * pool.length)
        if (i === lastNote) i = (i + 2) % pool.length
        lastNote = i
        piano(R.arp, pool[i] + key, nextNote, 0.55 + Math.random() * 0.3, R.arp.musicBus)
        // now and then, a gentle answering note a beat later
        if (Math.random() < 0.3) piano(R.arp, pool[(i + 2) % pool.length] + key - 12, nextNote + 0.9 + Math.random() * 0.4, 0.4, R.arp.musicBus)
        nextNote += (3.5 + Math.random() * 4.5) * pianoRate
      }
    },
    stop(_rig, t) {
      release(pad, t, 1.2)
      release(air, t, 1.2)
      lfo?.stop(t + 6)
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
        piano(rig, 74 + key, t, 0.6, rig.sfxBus)
      },
      whoosh(rig, t, strength) {
        // a barely-there breath of air, no sweep
        const { ctx } = rig
        const o = osc(ctx, 'sine', mtof(86 + key))
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.004 * strength, t + 0.6)
        g.gain.linearRampToValueAtTime(0, t + 1.8)
        o.connect(g).connect(rig.sfxBus)
        g.connect(rig.reverbSend)
        o.start(t)
        o.stop(t + 1.9)
      },
      success(rig, t) {
        ;[66, 69, 74].forEach((m, i) => piano(rig, m + key, t + i * 0.12, 0.7, rig.sfxBus))
      },
      note(rig, t, i, vel) {
        const k = ((i % 16) + 16) % 16
        piano(rig, PIANO[k % PIANO.length] + 12 * Math.floor(k / PIANO.length) - 12 + key, t, 0.75 * vel, rig.sfxBus)
      },
      boot(rig, t) {
        piano(rig, 50, t + 0.2, 0.7, rig.sfxBus)
        piano(rig, 62, t + 0.9, 0.5, rig.sfxBus)
      },
    },
  }
}
