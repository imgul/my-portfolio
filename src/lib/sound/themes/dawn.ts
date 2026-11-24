/**
 * MARGALLA DAWN: organic, cinematic, with a South Asian accent. 70 BPM, D Yaman (Lydian).
 * Dmaj9 → E/D → Bm9 → A6 (two bars each).
 * Layers: tanpura drone (Pa–Sa–Sa–Sa) with a jawari "buzz" sweep, FM electric piano,
 * a bansuri-style flute that glides between notes (meend), and soft shaker + tabla-ish
 * percussion that only arrives when you scroll.
 * Scene layers: pad = tanpura + Rhodes · bass · drums = bayan · perc = dayan + shaker
 * arp = kalimba ostinato · lead = bansuri.
 */
import { mtof, osc, perc, noiseHit, noiseBuffer, makeLayers, setLayers, type Layers, type Rig } from '../rig'
import type { Theme } from '../types'

const BPM = 70
const EIGHTH = 60 / BPM / 2
const CHORDS = [
  { bass: 38, keys: [57, 61, 64, 66] }, // Dmaj9
  { bass: 38, keys: [56, 59, 64, 66] }, // E/D (the Lydian brightness)
  { bass: 35, keys: [57, 61, 62, 66] }, // Bm9
  { bass: 33, keys: [54, 57, 61, 64] }, // A6
]
const TANPURA = [45, 50, 50, 38] // Pa, Sa, Sa, low Sa
const SCALE = [62, 64, 66, 68, 69, 71, 73] // D Yaman
const FLUTE = [69, 71, 73, 74, 76, 78, 80, 81, 83, 85, 86]

export function createDawn(): Theme {
  let voices: { gain: GainNode; oscs: OscillatorNode[] }[] = []
  let step = 0
  let nextStep = 0
  let chord = CHORDS[0]
  let fluteBusyUntil = 0
  let fluteIdx = 4
  let lastFluteFreq = 0
  let lastFluteEnd = 0
  let layers: Layers | null = null
  let key = 0
  let pendingKey = 0
  const ARP_PAT = [0, 2, 1, 3, 2, 1, 3, 2]

  const kalimba = (rig: Rig, m: number, t: number, vol: number, out: AudioNode) => {
    const { ctx } = rig
    const f = mtof(m)
    const parts: [number, number, number][] = [
      [1, 1, 1.5],
      [2.01, 0.12, 0.4],
      [5.4, 0.35, 0.07],
    ]
    const g = ctx.createGain()
    g.gain.value = 1
    g.connect(out)
    g.connect(rig.reverbSend)
    g.connect(rig.delaySend)
    parts.forEach(([ratio, amp, dec]) => {
      const o = osc(ctx, 'sine', f * ratio)
      const pg = ctx.createGain()
      perc(pg.gain, t, vol * amp, 0.002, dec)
      o.connect(pg).connect(g)
      o.start(t)
      o.stop(t + dec + 0.1)
    })
  }

  const tanpura = (rig: Rig, m: number, t: number) => {
    const { ctx } = rig
    const buzz = ctx.createBiquadFilter()
    buzz.type = 'peaking'
    buzz.Q.value = 7
    buzz.gain.value = 14
    buzz.frequency.setValueAtTime(500, t)
    buzz.frequency.exponentialRampToValueAtTime(3200, t + 2.6)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3800
    const g = ctx.createGain()
    perc(g.gain, t, 0.022, 0.02, 4.2)
    const a = osc(ctx, 'sawtooth', mtof(m + key), -3)
    const b = osc(ctx, 'sawtooth', mtof(m + key), 3)
    a.connect(buzz)
    b.connect(buzz)
    buzz.connect(lp).connect(g)
    g.connect(rig.musicBus)
    g.connect(rig.reverbSend)
    a.start(t)
    b.start(t)
    a.stop(t + 4.4)
    b.stop(t + 4.4)
  }

  const release = (t: number, tau: number) => {
    for (const v of voices) {
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0, t, tau)
      v.oscs.forEach((o) => o.stop(t + tau * 6))
    }
    voices = []
  }

  /** Rhodes-like FM electric piano. */
  const keys = (rig: Rig, t: number, vel: number, keep = true) => {
    const { ctx } = rig
    if (keep) release(t, 0.5)
    chord.keys.forEach((m, i) => {
      const s = t + i * 0.035
      const f = mtof(m + key)
      const car = osc(ctx, 'sine', f)
      const mod = osc(ctx, 'sine', f)
      const idx = ctx.createGain()
      idx.gain.setValueAtTime(f * 1.4 * vel, s)
      idx.gain.setTargetAtTime(f * 0.12, s, 0.35)
      mod.connect(idx).connect(car.frequency)
      const g = ctx.createGain()
      g.gain.value = 0
      g.gain.setValueAtTime(0.0001, s)
      g.gain.linearRampToValueAtTime(0.06 * vel, s + 0.005)
      g.gain.setTargetAtTime(0.02 * vel, s + 0.01, 0.7)
      car.connect(g).connect(rig.musicBus)
      g.connect(rig.reverbSend)
      car.start(s)
      mod.start(s)
      if (keep) voices.push({ gain: g, oscs: [car, mod] })
      else {
        g.gain.setTargetAtTime(0, s + 1.2, 0.4)
        car.stop(s + 3.5)
        mod.stop(s + 3.5)
      }
    })
  }

  const bass = (rig: Rig, t: number) => {
    const { ctx } = rig
    const o = osc(ctx, 'sine', mtof(chord.bass + key))
    const o2 = osc(ctx, 'triangle', mtof(chord.bass + key + 12))
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.065, t + 0.12)
    g.gain.setTargetAtTime(0.04, t + 0.2, 1.5)
    g.gain.setTargetAtTime(0.0001, t + EIGHTH * 15, 0.2)
    const g2 = ctx.createGain()
    g2.gain.value = 0.12
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(rig.musicBus)
    const end = t + EIGHTH * 16 + 1.5
    o.start(t)
    o2.start(t)
    o.stop(end)
    o2.stop(end)
  }

  const flute = (rig: Rig, m: number, t: number, dur: number, vol: number) => {
    const { ctx } = rig
    const f = mtof(m)
    const o = osc(ctx, 'sine', f)
    const h2 = osc(ctx, 'sine', f * 2)
    const h3 = osc(ctx, 'sine', f * 3)
    // meend (glide) from the previous note if it was recent
    if (lastFluteFreq && t - lastFluteEnd < 1.2) {
      ;[o, h2, h3].forEach((x, k) => {
        x.frequency.setValueAtTime(lastFluteFreq * (k + 1), t)
        x.frequency.exponentialRampToValueAtTime(f * (k + 1), t + 0.14)
      })
    }
    // delayed vibrato
    const lfo = osc(ctx, 'sine', 5.2)
    const vib = ctx.createGain()
    vib.gain.value = 0
    vib.gain.setValueAtTime(0, t)
    vib.gain.linearRampToValueAtTime(0, t + 0.3)
    vib.gain.linearRampToValueAtTime(14, t + 0.8)
    lfo.connect(vib)
    ;[o, h2, h3].forEach((x) => vib.connect(x.detune))
    const mix = ctx.createGain()
    const g2 = ctx.createGain()
    g2.gain.value = 0.14
    const g3 = ctx.createGain()
    g3.gain.value = 0.05
    o.connect(mix)
    h2.connect(g2).connect(mix)
    h3.connect(g3).connect(mix)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3600
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.12)
    g.gain.setTargetAtTime(vol * 0.8, t + 0.15, 0.4)
    g.gain.setTargetAtTime(0.0001, t + dur, 0.12)
    mix.connect(lp).connect(g)
    g.connect(rig.musicBus)
    g.connect(rig.reverbSend)
    g.connect(rig.delaySend)
    const end = t + dur + 0.8
    ;[o, h2, h3, lfo].forEach((x) => {
      x.start(t)
      x.stop(end)
    })
    // breath
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const bf = ctx.createBiquadFilter()
    bf.type = 'bandpass'
    bf.frequency.value = f * 1.5
    bf.Q.value = 1.2
    const bg = ctx.createGain()
    bg.gain.value = 0
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.linearRampToValueAtTime(vol * 0.35, t + 0.05)
    bg.gain.setTargetAtTime(vol * 0.06, t + 0.08, 0.15)
    bg.gain.setTargetAtTime(0.0001, t + dur, 0.1)
    src.connect(bf).connect(bg)
    bg.connect(rig.musicBus)
    bg.connect(rig.reverbSend)
    src.start(t, Math.random(), Math.min(1.9, dur + 0.6))
    lastFluteFreq = f
    lastFluteEnd = t + dur
  }

  const bayan = (rig: Rig, t: number, vol: number) => {
    const { ctx } = rig
    const o = osc(ctx, 'sine', 68)
    o.frequency.setValueAtTime(68, t)
    o.frequency.linearRampToValueAtTime(96, t + 0.28)
    const g = ctx.createGain()
    perc(g.gain, t, vol, 0.004, 0.6)
    o.connect(g).connect(rig.musicBus)
    o.start(t)
    o.stop(t + 0.7)
  }

  const dayan = (rig: Rig, t: number, vol: number) => {
    const { ctx } = rig
    ;[
      [1, 1, 0.22],
      [2.02, 0.45, 0.12],
      [2.98, 0.25, 0.08],
    ].forEach(([r, a, d]) => {
      const o = osc(ctx, 'sine', 523 * r)
      const g = ctx.createGain()
      perc(g.gain, t, vol * a, 0.002, d)
      o.connect(g).connect(rig.musicBus)
      g.connect(rig.reverbSend)
      o.start(t)
      o.stop(t + d + 0.05)
    })
    noiseHit(rig, t, { type: 'bandpass', freq: 3000, q: 1, peak: vol * 0.4, decay: 0.01, out: rig.musicBus })
  }

  const playStep = (t: number, energy: number) => {
    const L = layers!.rigs
    const s = step % 16
    const e8 = step % 8
    if (s === 0) {
      key = pendingKey
      chord = CHORDS[Math.floor(step / 16) % CHORDS.length]
      keys(L.pad, t, 1)
      bass(L.bass, t)
    } else if (s === 11 && energy > 0.3) {
      keys(L.pad, t, 0.55, false)
    }
    // tanpura: one pluck per beat
    if (step % 2 === 0) tanpura(L.pad, TANPURA[(step / 2) % 4], t)

    // kalimba ostinato (16ths-feel when moving)
    const m = chord.keys[ARP_PAT[step % ARP_PAT.length]] + 12 + key
    kalimba(L.arp, m, t, 0.035 + energy * 0.02, L.arp.musicBus)
    if (energy > 0.45 && step % 2 === 1) kalimba(L.arp, m + 7, t + EIGHTH / 2, 0.022, L.arp.musicBus)

    // flute phrases
    if (t >= fluteBusyUntil && step >= 8 && Math.random() < 0.1 + energy * 0.35) {
      const jump = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]
      fluteIdx = Math.max(0, Math.min(FLUTE.length - 1, fluteIdx + jump))
      const len = [2, 2, 3, 4, 4, 6][Math.floor(Math.random() * 6)]
      const dur = len * EIGHTH
      flute(L.lead, FLUTE[fluteIdx] + key, t, dur * 0.92, 0.065)
      fluteBusyUntil = t + dur
    }

    // percussion only when the visitor is moving
    if (e8 === 0) bayan(L.drums, t, 0.06 + energy * 0.08)
    if (energy > 0.35 && e8 === 5) bayan(L.drums, t, 0.05 + energy * 0.06)
    if (energy > 0.3 && (e8 === 2 || e8 === 3 || e8 === 6)) dayan(L.perc, t, 0.02 + energy * 0.03)
    if (energy > 0.12) {
      const acc = [1, 0.45, 0.7, 0.45][step % 4]
      noiseHit(L.perc, t, { type: 'highpass', freq: 5500, peak: (0.006 + energy * 0.022) * acc, attack: 0.012, decay: 0.06, out: L.perc.musicBus, pan: step % 2 ? 0.3 : -0.3 })
    }
  }

  return {
    fx: {
      reverbSeconds: 4.2,
      reverbDecay: 2.2,
      reverbLevel: 0.85,
      delayTime: EIGHTH * 1.5,
      delayFeedback: 0.3,
      delayTone: 2200,
      musicLevel: 0.9,
      sfxLevel: 0.75,
    },
    bpm: BPM,
    scene(_rig, sc, t) {
      if (layers) setLayers(layers, sc.layers, t)
      pendingKey = sc.key
    },
    start(rig, t) {
      layers = makeLayers(rig, 0)
      step = 0
      nextStep = t + 0.05
      fluteBusyUntil = 0
      lastFluteFreq = 0
    },
    tick(_rig, _now, horizon, energy) {
      while (horizon >= nextStep) {
        playStep(nextStep, energy)
        step++
        nextStep += EIGHTH
      }
    },
    stop(_rig, t) {
      release(t, 0.4)
    },
    sfx: {
      hover(rig, t) {
        const { ctx } = rig
        const o = osc(ctx, 'sine', 1600)
        o.frequency.setValueAtTime(1600, t)
        o.frequency.exponentialRampToValueAtTime(1150, t + 0.025)
        const g = ctx.createGain()
        perc(g.gain, t, 0.04, 0.001, 0.035)
        o.connect(g).connect(rig.sfxBus)
        o.start(t)
        o.stop(t + 0.06)
        noiseHit(rig, t, { type: 'bandpass', freq: 3600, q: 2, peak: 0.025, decay: 0.008, out: rig.sfxBus })
      },
      click(rig, t) {
        kalimba(rig, 74, t, 0.09, rig.sfxBus)
        kalimba(rig, 81, t + 0.06, 0.07, rig.sfxBus)
      },
      whoosh(rig, t, strength) {
        const { ctx } = rig
        const dur = 1.3
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx)
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.Q.value = 0.9
        f.frequency.setValueAtTime(450, t)
        f.frequency.exponentialRampToValueAtTime(1700, t + dur * 0.55)
        f.frequency.exponentialRampToValueAtTime(550, t + dur)
        const g = ctx.createGain()
        g.gain.value = 0
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.085 * strength, t + dur * 0.5)
        g.gain.linearRampToValueAtTime(0, t + dur)
        src.connect(f).connect(g).connect(rig.sfxBus)
        g.connect(rig.reverbSend)
        src.start(t, Math.random() * 0.5, dur + 0.05)
        // airy shimmer
        ;[86, 93].forEach((m) => {
          const o = osc(ctx, 'sine', mtof(m))
          const sg = ctx.createGain()
          sg.gain.value = 0
          sg.gain.setValueAtTime(0, t)
          sg.gain.linearRampToValueAtTime(0.006 * strength, t + dur * 0.6)
          sg.gain.linearRampToValueAtTime(0, t + dur + 0.3)
          o.connect(sg).connect(rig.reverbSend)
          o.start(t)
          o.stop(t + dur + 0.4)
        })
      },
      success(rig, t) {
        ;[74, 78, 80, 81, 85, 86].forEach((m, i) => kalimba(rig, m, t + i * 0.075, 0.08, rig.sfxBus))
      },
      note(rig, t, i, vel) {
        const k = ((i % 15) + 15) % 15
        kalimba(rig, SCALE[k % 7] + 12 * Math.floor(k / 7) + key, t, 0.1 * vel, rig.sfxBus)
      },
      boot(rig, t) {
        const { ctx } = rig
        // singing bowl: inharmonic partials, each a slowly beating pair
        const f0 = mtof(62)
        ;[
          [1, 1, 6],
          [2.76, 0.45, 4.5],
          [5.4, 0.2, 3],
          [8.93, 0.08, 2],
        ].forEach(([r, a, d]) => {
          ;[0, 0.8].forEach((beat) => {
            const o = osc(ctx, 'sine', f0 * r + beat)
            const g = ctx.createGain()
            perc(g.gain, t, 0.05 * a, 0.006, d)
            o.connect(g).connect(rig.sfxBus)
            g.connect(rig.reverbSend)
            o.start(t)
            o.stop(t + d + 0.1)
          })
        })
        noiseHit(rig, t, { type: 'lowpass', freq: 500, peak: 0.12, decay: 0.06, out: rig.sfxBus })
        this.whoosh(rig, t + 0.1, 1.1)
        kalimba(rig, 74, t + 0.5, 0.06, rig.sfxBus)
        kalimba(rig, 81, t + 0.62, 0.05, rig.sfxBus)
      },
    },
  }
}
