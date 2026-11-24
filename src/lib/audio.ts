/**
 * Generative audio engine. No audio files: everything is synthesized live
 * with the Web Audio API. The sound itself lives in swappable themes
 * (src/lib/sound/themes). Each theme provides background music + UI SFX.
 *
 * Pick a theme with ?sound=original|pulse|dawn (remembered in localStorage).
 * Scroll energy feeds the music; an analyser feeds the 3D scene.
 * The Conductor re-arranges the music for every section (see sound/scenes.ts).
 */
import { applyFx, Conductor, createRig, getTheme, mtof, noiseBuffer, osc, perc, SCENES, THEMES, type Rig, type Theme } from './sound'

// v2: everyone starts on the calm Deep Focus track (older picks are not carried over)
const STORAGE_KEY = 'gul:sound-theme-v2'

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
  private conductor!: Conductor
  private section = 0
  private lastSting = 0
  private listeners = new Set<() => void>()
  themeId = getTheme(initialThemeId()).id
  private energy = 0
  private muted = true
  private musicOn = false
  private lastHover = 0
  private charge: {
    oscs: OscillatorNode[]
    lfo: OscillatorNode
    filter: BiquadFilterNode
    gain: GainNode
    trem: GainNode
  } | null = null

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.rig = createRig(this.ctx)
    this.analyserData = new Uint8Array(this.rig.analyser.frequencyBinCount)
    this.theme = getTheme(this.themeId).create()
    applyFx(this.rig, this.theme.fx)
    this.conductor = new Conductor(this.rig, this.theme)
    this.conductor.setScene(this.section, 0, false)
  }

  /** Subscribe to theme / section changes (for the "now playing" UI). */
  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }

  get themeName() {
    return getTheme(this.themeId).name.replace(/^[A-Z] · /, '')
  }

  get sceneInfo() {
    return SCENES[this.section] ?? SCENES[0]
  }

  /** Called when the visitor scrolls into a new section. */
  setSection(i: number) {
    if (i === this.section) return
    this.section = i
    if (this.ctx && this.conductor) {
      const t = this.ctx.currentTime
      // Signature stinger only when audible, and not machine-gunned during fast scrolls.
      const now = performance.now()
      const sting = this.ready() && now - this.lastSting > 1100
      if (sting) this.lastSting = now
      this.conductor.setScene(i, t, sting)
    }
    this.emit()
  }

  /** Cycle to the next theme (used by the "now playing" chip). */
  nextTheme() {
    const i = THEMES.findIndex((t) => t.id === this.themeId)
    this.setTheme(THEMES[(i + 1) % THEMES.length].id)
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
    if (this.ctx) {
      this.theme = info.create()
      this.conductor.setTheme(this.theme, this.ctx.currentTime)
    }
    this.emit()
  }

  /* ------------------------------ Music ------------------------------ */

  private startMusic() {
    if (!this.ctx || this.musicOn) return
    this.musicOn = true
    this.conductor.start(this.ctx.currentTime)
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
    this.conductor.tick(now, now + 0.25, this.energy)
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
    if (now - this.lastHover < 140) return
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

  /* ------------------------- Press & hold charge ------------------------- */

  /** Start the rising "charging" synth used by press-and-hold buttons. */
  chargeStart() {
    if (!this.ready()) return
    this.chargeKill(0.05)
    const { ctx } = this.rig
    const t = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 9
    filter.frequency.value = 380
    const trem = ctx.createGain()
    trem.gain.value = 0.75
    const lfo = osc(ctx, 'sine', 5)
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = 0.25
    lfo.connect(lfoAmt).connect(trem.gain)
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.setTargetAtTime(0.07, t, 0.04)
    const oscs = [osc(ctx, 'sawtooth', 110, -9), osc(ctx, 'square', 110, 9), osc(ctx, 'sine', 55)]
    oscs.forEach((o) => o.connect(filter))
    filter.connect(trem).connect(gain)
    gain.connect(this.rig.sfxBus)
    gain.connect(this.rig.reverbSend)
    oscs.forEach((o) => o.start(t))
    lfo.start(t)
    this.charge = { oscs, lfo, filter, gain, trem }
  }

  /** Map hold progress (0..1) onto pitch, brightness, tremolo speed and level. */
  chargeSet(p: number) {
    const c = this.charge
    if (!c || !this.ctx) return
    const t = this.ctx.currentTime
    const f = 110 * Math.pow(2, p * 2.6)
    c.oscs[0].frequency.setTargetAtTime(f, t, 0.03)
    c.oscs[1].frequency.setTargetAtTime(f * 1.5, t, 0.03)
    c.oscs[2].frequency.setTargetAtTime(f / 2, t, 0.03)
    c.filter.frequency.setTargetAtTime(380 + Math.pow(p, 1.5) * 5200, t, 0.03)
    c.lfo.frequency.setTargetAtTime(5 + p * 22, t, 0.05)
    c.gain.gain.setTargetAtTime(0.06 + p * 0.06, t, 0.05)
  }

  /** One step of the charge: an ascending note from the theme's scale + a ratchet click. */
  chargeTick(i: number) {
    if (!this.ready()) return
    const t = this.now
    this.theme.sfx.note(this.rig, t, i, 0.55)
    const { ctx } = this.rig
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 2400 + i * 260
    f.Q.value = 4
    const g = ctx.createGain()
    perc(g.gain, t, 0.05, 0.001, 0.025)
    src.connect(f).connect(g).connect(this.rig.sfxBus)
    src.start(t, Math.random(), 0.05)
  }

  /** Let go too early: the charge powers down. */
  chargeCancel() {
    const c = this.charge
    if (!c || !this.ctx) return
    const t = this.ctx.currentTime
    c.oscs.forEach((o, k) => {
      o.frequency.cancelScheduledValues(t)
      o.frequency.setValueAtTime(o.frequency.value, t)
      o.frequency.exponentialRampToValueAtTime(k === 2 ? 20 : 40, t + 0.4)
    })
    c.filter.frequency.setTargetAtTime(200, t, 0.1)
    this.chargeKill(0.12)
  }

  /** Fully charged: boom + crack + sparkle chord in the current theme. */
  chargeRelease() {
    this.chargeKill(0.03)
    if (!this.ready()) return
    const { ctx } = this.rig
    const t = ctx.currentTime
    // sub boom
    const sub = osc(ctx, 'sine', 140)
    sub.frequency.setValueAtTime(140, t)
    sub.frequency.exponentialRampToValueAtTime(34, t + 0.7)
    const sg = ctx.createGain()
    perc(sg.gain, t, 0.5, 0.005, 0.9)
    sub.connect(sg).connect(this.rig.sfxBus)
    sub.start(t)
    sub.stop(t + 1)
    // crack: falling noise burst
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx)
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.Q.value = 1.4
    nf.frequency.setValueAtTime(6000, t)
    nf.frequency.exponentialRampToValueAtTime(400, t + 0.5)
    const ng = ctx.createGain()
    perc(ng.gain, t, 0.16, 0.002, 0.5)
    src.connect(nf).connect(ng).connect(this.rig.sfxBus)
    ng.connect(this.rig.reverbSend)
    src.start(t, 0, 0.6)
    // theme success + high sparkles through the delay
    this.theme.sfx.success(this.rig, t + 0.04)
    ;[86, 90, 93, 98, 102].forEach((m, i) => {
      const s = t + 0.12 + i * 0.045 + Math.random() * 0.02
      const o = osc(ctx, 'sine', mtof(m))
      const g = ctx.createGain()
      perc(g.gain, s, 0.035, 0.002, 0.5)
      o.connect(g).connect(this.rig.sfxBus)
      g.connect(this.rig.delaySend)
      g.connect(this.rig.reverbSend)
      o.start(s)
      o.stop(s + 0.6)
    })
  }

  private chargeKill(tau: number) {
    const c = this.charge
    if (!c || !this.ctx) return
    const t = this.ctx.currentTime
    c.gain.gain.cancelScheduledValues(t)
    c.gain.gain.setTargetAtTime(0, t, tau)
    ;[...c.oscs, c.lfo].forEach((o) => o.stop(t + tau * 8 + 0.05))
    this.charge = null
  }

  boot() {
    if (this.ready()) this.theme.sfx.boot(this.rig, this.now)
  }
}

export const audio = new AudioEngine()

if (import.meta.env.DEV) (window as unknown as { __audio: AudioEngine }).__audio = audio
