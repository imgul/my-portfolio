/**
 * Generative audio engine. No audio files: everything is synthesized live
 * with the Web Audio API. The sound itself lives in swappable themes
 * (src/lib/sound/themes). Each theme provides background music + UI SFX.
 *
 * Pick a theme with ?sound=original|pulse|dawn (remembered in localStorage).
 * Scroll energy feeds the music; an analyser feeds the 3D scene.
 */
import { applyFx, createRig, getTheme, type Rig, type Theme } from './sound'

const STORAGE_KEY = 'gul:sound-theme'

function initialThemeId() {
  try {
    const q = new URLSearchParams(window.location.search).get('sound')
    if (q) {
      localStorage.setItem(STORAGE_KEY, q)
      return q
    }
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

class AudioEngine {
  ctx: AudioContext | null = null
  private rig!: Rig
  private analyserData!: Uint8Array<ArrayBuffer>
  private theme!: Theme
  themeId = getTheme(initialThemeId()).id
  private energy = 0
  private muted = true
  private musicOn = false
  private lastHover = 0

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.rig = createRig(this.ctx)
    this.analyserData = new Uint8Array(this.rig.analyser.frequencyBinCount)
    this.theme = getTheme(this.themeId).create()
    applyFx(this.rig, this.theme.fx)
  }

  get isMuted() {
    return this.muted
  }

  async setMuted(m: boolean) {
    this.init()
    if (!this.ctx) return
    this.muted = m
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    const g = this.rig.master.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setTargetAtTime(m ? 0 : 0.8, t, m ? 0.15 : 0.6)
    if (!m && !this.musicOn) this.startMusic()
  }

  /** Hot-swap the sound theme (music + SFX). */
  setTheme(id: string) {
    const info = getTheme(id)
    this.themeId = info.id
    try {
      localStorage.setItem(STORAGE_KEY, info.id)
    } catch {
      /* ignore */
    }
    if (!this.ctx) return
    const t = this.ctx.currentTime
    if (this.musicOn) this.theme.stop(this.rig, t)
    this.theme = info.create()
    applyFx(this.rig, this.theme.fx, t)
    if (this.musicOn) this.theme.start(this.rig, t + 0.3)
  }

  /* ------------------------------ Music ------------------------------ */

  private startMusic() {
    if (!this.ctx || this.musicOn) return
    this.musicOn = true
    this.theme.start(this.rig, this.ctx.currentTime)
    window.setInterval(() => this.schedule(), 100)
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) this.ctx.suspend()
      else if (!this.muted) this.ctx.resume()
    })
  }

  private schedule() {
    const now = this.ctx!.currentTime
    // Smoothly relax scroll energy.
    this.energy *= 0.92
    this.theme.tick(this.rig, now, now + 0.25, this.energy)
  }

  /* --------------------------- Interaction --------------------------- */

  private ready() {
    return !!this.ctx && !this.muted && this.ctx.state === 'running'
  }

  private get now() {
    return this.ctx!.currentTime
  }

  /** Feed scroll velocity (0..1) to make the music react to movement. */
  pushEnergy(v: number) {
    this.energy = Math.min(1, Math.max(this.energy, v))
  }

  level() {
    if (!this.ctx || this.muted) return 0
    this.rig.analyser.getByteFrequencyData(this.analyserData)
    let sum = 0
    for (let i = 0; i < 24; i++) sum += this.analyserData[i]
    return sum / (24 * 255)
  }

  hover() {
    if (!this.ready()) return
    const now = performance.now()
    if (now - this.lastHover < 45) return
    this.lastHover = now
    this.theme.sfx.hover(this.rig, this.now)
  }

  click() {
    if (this.ready()) this.theme.sfx.click(this.rig, this.now)
  }

  whoosh(strength = 1) {
    if (this.ready()) this.theme.sfx.whoosh(this.rig, this.now, strength)
  }

  success() {
    if (this.ready()) this.theme.sfx.success(this.rig, this.now)
  }

  /** Play the i-th note of the theme's playable scale. */
  note(i: number, vel = 1) {
    if (this.ready()) this.theme.sfx.note(this.rig, this.now, i, vel)
  }

  boot() {
    if (this.ready()) this.theme.sfx.boot(this.rig, this.now)
  }
}

export const audio = new AudioEngine()
