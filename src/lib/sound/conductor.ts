/**
 * The Conductor turns a theme into a score that follows the page.
 * Per section it:
 *  - crossfades the theme's arrangement layers and queues a key change (theme.scene)
 *  - opens/closes the music bus tone and the reverb "space"
 *  - swaps the ambient textures (wind, birds, clock, data chatter, vinyl)
 *  - plays a short signature motif (each section has its own little melody)
 *  - sets a groove floor ("drive") so busy sections keep moving even when you stop scrolling
 */
import { Ambience } from './ambience'
import { applyFx, noiseBuffer, type Rig } from './rig'
import { SCENES, brightToHz, type Scene } from './scenes'
import type { Theme } from './types'

/** Signature motifs, in scale degrees of the theme's playable scale. */
const MOTIFS: number[][] = [
  [0, 4, 7],
  [2, 4, 5],
  [0, 2, 4, 7],
  [4, 5, 7, 9],
  [7, 4, 2],
  [0, 3, 5, 3],
  [5, 7, 5, 9],
  [2, 0, 4],
  [4, 7, 11],
  [0, 4, 7, 9, 11],
]

export class Conductor {
  readonly rig: Rig
  theme: Theme
  readonly ambience: Ambience
  index = 0
  private started = false

  constructor(rig: Rig, theme: Theme) {
    this.rig = rig
    this.theme = theme
    this.ambience = new Ambience(rig)
  }

  get scene(): Scene {
    return SCENES[this.index] ?? SCENES[0]
  }

  start(t: number) {
    this.started = true
    this.theme.start(this.rig, t)
    this.ambience.start(t, this.theme.bpm, t + 0.05)
    this.apply(t, 0.05)
  }

  setTheme(theme: Theme, t: number) {
    if (this.started) this.theme.stop(this.rig, t)
    this.theme = theme
    applyFx(this.rig, theme.fx, t)
    if (this.started) {
      theme.start(this.rig, t + 0.3)
      this.ambience.setTempo(theme.bpm, t + 0.35)
      this.apply(t + 0.3, 0.05)
    }
  }

  /** Move to section `i`. Returns true when the section actually changed. */
  setScene(i: number, t: number, stinger = true) {
    const next = Math.max(0, Math.min(SCENES.length - 1, i))
    if (next === this.index) return false
    this.index = next
    if (this.started) {
      this.apply(t, 1.2)
      if (stinger && this.theme.stingers !== false) this.stinger(next, t)
    }
    return true
  }

  tick(now: number, horizon: number, energy: number) {
    const e = Math.max(energy, this.scene.drive)
    this.theme.tick(this.rig, now, horizon, e)
    this.ambience.tick(now, horizon)
  }

  stop(t: number) {
    this.theme.stop(this.rig, t)
    this.ambience.stop(t)
    this.started = false
  }

  private apply(t: number, tau: number) {
    const sc = this.scene
    this.theme.scene(this.rig, sc, t)
    const amt = this.theme.ambience ?? 0.6
    const amb: Scene['amb'] = {}
    for (const [k, v] of Object.entries(sc.amb)) amb[k as keyof Scene['amb']] = (v ?? 0) * amt
    this.ambience.set(amb, t)
    const tone = this.rig.musicTone.frequency
    tone.cancelScheduledValues(t)
    tone.setTargetAtTime(brightToHz(sc.bright), t, tau * 1.3)
    const rv = this.rig.reverbOut.gain
    rv.cancelScheduledValues(t)
    rv.setTargetAtTime(this.theme.fx.reverbLevel * sc.space, t, tau * 1.5)
  }

  /** A soft swell that lands on the section's signature motif. */
  stinger(i: number, t: number) {
    const { ctx } = this.rig
    const swell = 0.45
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.4
    f.frequency.setValueAtTime(600, t)
    f.frequency.exponentialRampToValueAtTime(4800, t + swell)
    const g = ctx.createGain()
    g.gain.value = 0
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.03, t + swell)
    g.gain.linearRampToValueAtTime(0, t + swell + 0.04)
    src.connect(f).connect(g).connect(this.rig.sfxBus)
    g.connect(this.rig.reverbSend)
    src.start(t, Math.random(), swell + 0.1)
    const motif = MOTIFS[i % MOTIFS.length]
    motif.forEach((deg, k) => this.theme.sfx.note(this.rig, t + swell + k * 0.11, deg + 5, 0.42 - k * 0.04))
  }
}
