/**
 * ORIGINAL: the first soundtrack. Slow ambient pad (Dmaj9 → Bm9 → Gmaj7#11 → Asus)
 * with a probabilistic pentatonic music box.
 */
import { mtof, osc, perc, noiseBuffer, noiseHit, makeLayers, setLayers, type Layers, type Rig } from '../rig'
import { kick } from '../voices'
import type { Theme } from '../types'

const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 59, 61],
  [45, 52, 57, 59, 64],
]
const PENTA = [62, 64, 66, 69, 71]

export function createOriginal(): Theme {
  let padFilter: BiquadFilterNode | null = null
  let lfo: OscillatorNode | null = null
  let voices: { gain: GainNode; oscs: OscillatorNode[] }[] = []
  let chordIndex = 0
  let nextBar = 0
  let nextPluck = 0
  let layers: Layers | null = null
  let key = 0
  let pendingKey = 0
  let pluckN = 0

  const pluck = (rig: Rig, freq: number, t: number, vol: number, out: AudioNode) => {
    const { ctx } = rig
    const o = osc(ctx, 'sine', freq)
    const o2 = osc(ctx, 'triangle', freq * 2.001)
    const g = ctx.createGain()
    perc(g.gain, t, vol, 0.008, 1.6)
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(out)
    g.connect(rig.delaySend)
    g.connect(rig.reverbSend)
    o.start(t)
    o2.start(t)
    o.stop(t + 1.7)
    o2.stop(t + 1.7)
  }

  const releaseVoices = (t: number, tau = 1.6) => {
    for (const v of voices) {
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0, t, tau)
      v.oscs.forEach((o) => o.stop(t + tau * 5))
    }
    voices = []
  }

  const playChord = (rig: Rig, t: number) => {
    const { ctx } = rig
    const D = layers!.rigs
    key = pendingKey
    const chord = CHORDS[chordIndex % CHORDS.length].map((n) => n + key)
    chordIndex++
    releaseVoices(t)
    // soft heartbeat on the bar when the scene has drums
    kick(D.drums, t, 0.32, D.drums.musicBus, 90, 40, 0.5)
    kick(D.drums, t + 0.32, 0.18, D.drums.musicBus, 80, 40, 0.4)
    ;[chord[0] - 12, ...chord].forEach((m, i) => {
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setTargetAtTime(i === 0 ? 0.11 : 0.035, t, 1.4)
      g.connect(i === 0 ? D.bass.musicBus : padFilter!)
      const types: OscillatorType[] = i === 0 ? ['sine'] : ['sawtooth', 'triangle']
      const oscs = types.map((type, k) => {
        const o = osc(ctx, type, mtof(m), (k === 0 ? -7 : 7) + (Math.random() * 4 - 2))
        o.connect(g)
        o.start(t)
        return o
      })
      voices.push({ gain: g, oscs })
    })
  }

  return {
    bpm: 75,
    scene(_rig, sc, t) {
      if (layers) setLayers(layers, sc.layers, t)
      pendingKey = sc.key
    },
    fx: {
      reverbSeconds: 3.2,
      reverbDecay: 2.4,
      reverbLevel: 0.9,
      delayTime: 0.375,
      delayFeedback: 0.38,
      delayTone: 2600,
      musicLevel: 0.55,
      sfxLevel: 0.7,
    },
    start(rig, t) {
      const { ctx } = rig
      padFilter = ctx.createBiquadFilter()
      padFilter.type = 'lowpass'
      padFilter.frequency.value = 700
      padFilter.Q.value = 0.7
      layers = layers ?? makeLayers(rig, 0)
      padFilter.connect(layers.rigs.pad.musicBus)
      padFilter.connect(layers.rigs.pad.reverbSend)
      lfo = osc(ctx, 'sine', 0.07)
      const lg = ctx.createGain()
      lg.gain.value = 250
      lfo.connect(lg).connect(padFilter.frequency)
      lfo.start(t)
      nextBar = t + 0.05
      nextPluck = t + 1.5
    },
    tick(rig, now, horizon, energy) {
      padFilter!.frequency.setTargetAtTime(650 + energy * 2600, now, 0.25)
      while (horizon >= nextBar) {
        playChord(rig, nextBar)
        nextBar += 9.6
      }
      const D = layers!.rigs
      while (horizon >= nextPluck) {
        const chord = CHORDS[(chordIndex + CHORDS.length - 1) % CHORDS.length].map((n) => n + key)
        const pool = [...PENTA.map((n) => n + 12 + key), chord[3] + 12, chord[4] + 12]
        if (Math.random() < 0.28 + energy * 0.45) {
          pluck(D.arp, mtof(pool[Math.floor(Math.random() * pool.length)]), nextPluck, 0.05 + Math.random() * 0.04, D.arp.musicBus)
        }
        // lead: an occasional higher answer phrase
        if (pluckN % 4 === 2 && Math.random() < 0.35 + energy * 0.3) {
          pluck(D.lead, mtof(pool[Math.floor(Math.random() * pool.length)] + 12), nextPluck, 0.045, D.lead.musicBus)
        }
        // perc: soft ticks on the grid
        noiseHit(D.perc, nextPluck, { type: 'highpass', freq: 6500, peak: pluckN % 2 ? 0.012 : 0.022, decay: 0.03, out: D.perc.musicBus, pan: pluckN % 2 ? 0.3 : -0.3 })
        pluckN++
        nextPluck += 0.4
      }
    },
    stop(_rig, t) {
      releaseVoices(t, 0.4)
      lfo?.stop(t + 2)
    },
    sfx: {
      hover(rig, t) {
        const o = osc(rig.ctx, 'sine', 2200)
        o.frequency.setValueAtTime(2200, t)
        o.frequency.exponentialRampToValueAtTime(1400, t + 0.04)
        const g = rig.ctx.createGain()
        perc(g.gain, t, 0.06, 0.001, 0.06)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 0.08)
      },
      click(rig, t) {
        ;[880, 1320].forEach((f, i) => {
          const s = t + i * 0.045
          const o = osc(rig.ctx, 'triangle', f)
          const g = rig.ctx.createGain()
          perc(g.gain, s, 0.12, 0.004, 0.18)
          o.connect(g).connect(rig.sfxBus)
          g.connect(rig.reverbSend)
          o.start(s)
          o.stop(s + 0.2)
        })
      },
      whoosh(rig, t, strength) {
        const { ctx } = rig
        const dur = 1.1
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx)
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.Q.value = 1.2
        f.frequency.setValueAtTime(300, t)
        f.frequency.exponentialRampToValueAtTime(2800, t + dur * 0.55)
        f.frequency.exponentialRampToValueAtTime(500, t + dur)
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.09 * strength, t + dur * 0.5)
        g.gain.linearRampToValueAtTime(0, t + dur)
        src.connect(f).connect(g).connect(rig.sfxBus)
        g.connect(rig.reverbSend)
        src.start(t, 0, dur)
      },
      success(rig, t) {
        ;[74, 78, 81, 86].forEach((m, i) => pluck(rig, mtof(m), t + i * 0.07, 0.12, rig.sfxBus))
      },
      note(rig, t, i, vel) {
        const oct = Math.floor(i / PENTA.length) % 4
        pluck(rig, mtof(PENTA[i % PENTA.length] + 12 * (oct - 1) + key), t, 0.12 * vel, rig.sfxBus)
      },
      boot(rig, t) {
        const { ctx } = rig
        const o = osc(ctx, 'sine', 40)
        o.frequency.setValueAtTime(40, t)
        o.frequency.exponentialRampToValueAtTime(110, t + 0.9)
        const g = ctx.createGain()
        perc(g.gain, t, 0.35, 0.05, 1.55)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 1.7)
        this.whoosh(rig, t, 1.4)
        ;[62, 69, 74, 78].forEach((m, i) => pluck(rig, mtof(m), t + 0.25 + i * 0.12, 0.1, rig.sfxBus))
      },
    },
  }
}
