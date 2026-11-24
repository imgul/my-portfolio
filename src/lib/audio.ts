/**
 * Generative audio engine — no audio files, everything is synthesized live
 * with the Web Audio API:
 *  - an evolving ambient pad + bass that drifts through a chord progression
 *  - a generative "music box" of pentatonic plucks through delay + reverb
 *  - UI sound effects (hover ticks, clicks, whooshes, success chimes)
 *  - a playable scale used by the "play my stack" section
 * Scroll energy opens the filter, and an analyser feeds the 3D scene.
 */

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

const CHORDS = [
  [50, 57, 61, 64, 66], // Dmaj9
  [47, 54, 57, 61, 62], // Bm9
  [43, 50, 54, 59, 61], // Gmaj7#11
  [45, 52, 57, 59, 64], // A sus
]
const PENTA = [62, 64, 66, 69, 71] // D major pentatonic

class AudioEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private reverb!: ConvolverNode
  private reverbSend!: GainNode
  private delay!: DelayNode
  private delaySend!: GainNode
  private padFilter!: BiquadFilterNode
  private analyser!: AnalyserNode
  private analyserData!: Uint8Array<ArrayBuffer>
  private voices: { gain: GainNode; oscs: OscillatorNode[] }[] = []
  private chordIndex = 0
  private nextBar = 0
  private nextPluck = 0
  private energy = 0
  private muted = true
  private musicOn = false
  private lastHover = 0

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 4
    comp.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(comp)

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount)
    this.master.connect(this.analyser)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.55
    this.musicBus.connect(this.master)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.7
    this.sfxBus.connect(this.master)

    // Reverb from a generated impulse response
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse(3.2, 2.4)
    const reverbOut = ctx.createGain()
    reverbOut.gain.value = 0.9
    this.reverb.connect(reverbOut).connect(this.master)
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 1
    this.reverbSend.connect(this.reverb)

    // Ping-pong-ish feedback delay
    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = 0.375
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const dlFilter = ctx.createBiquadFilter()
    dlFilter.type = 'lowpass'
    dlFilter.frequency.value = 2600
    this.delay.connect(dlFilter).connect(fb).connect(this.delay)
    const dlOut = ctx.createGain()
    dlOut.gain.value = 0.5
    this.delay.connect(dlOut).connect(this.master)
    dlOut.connect(this.reverbSend)
    this.delaySend = ctx.createGain()
    this.delaySend.connect(this.delay)

    // Pad filter with a slow LFO
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 700
    this.padFilter.Q.value = 0.7
    this.padFilter.connect(this.musicBus)
    this.padFilter.connect(this.reverbSend)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 250
    lfo.connect(lfoGain).connect(this.padFilter.frequency)
    lfo.start()
  }

  private makeImpulse(seconds: number, decay: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  get isMuted() {
    return this.muted
  }

  async setMuted(m: boolean) {
    this.init()
    if (!this.ctx) return
    this.muted = m
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, t, m ? 0.15 : 0.6)
    if (!m && !this.musicOn) this.startMusic()
  }

  /* ------------------------------ Music ------------------------------ */

  private startMusic() {
    if (!this.ctx || this.musicOn) return
    this.musicOn = true
    this.nextBar = this.ctx.currentTime + 0.05
    this.nextPluck = this.ctx.currentTime + 1.5
    window.setInterval(() => this.schedule(), 100)
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) this.ctx.suspend()
      else if (!this.muted) this.ctx.resume()
    })
  }

  private schedule() {
    const ctx = this.ctx!
    const now = ctx.currentTime
    // Smoothly relax scroll energy and map it onto the pad filter.
    this.energy *= 0.92
    this.padFilter.frequency.setTargetAtTime(650 + this.energy * 2600, now, 0.25)

    if (now + 0.2 >= this.nextBar) {
      this.playChord(this.nextBar)
      this.nextBar += 9.6
    }
    while (now + 0.2 >= this.nextPluck) {
      const t = this.nextPluck
      const step = 0.4
      // Sparse, probabilistic melody; busier when user scrolls.
      if (Math.random() < 0.28 + this.energy * 0.45) {
        const chord = CHORDS[(this.chordIndex + CHORDS.length - 1) % CHORDS.length]
        const pool = [...PENTA.map((n) => n + 12), chord[3] + 12, chord[4] + 12]
        const n = pool[Math.floor(Math.random() * pool.length)]
        this.pluck(mtof(n), t, 0.05 + Math.random() * 0.04, true)
      }
      this.nextPluck += step
    }
  }

  private playChord(t: number) {
    const ctx = this.ctx!
    const chord = CHORDS[this.chordIndex % CHORDS.length]
    this.chordIndex++
    // release previous voices
    for (const v of this.voices) {
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setTargetAtTime(0, t, 1.6)
      v.oscs.forEach((o) => o.stop(t + 8))
    }
    this.voices = []
    const notes = [chord[0] - 12, ...chord]
    notes.forEach((m, i) => {
      const g = ctx.createGain()
      g.gain.value = 0
      const level = i === 0 ? 0.11 : 0.035
      g.gain.setTargetAtTime(level, t, 1.4)
      g.connect(this.padFilter)
      const oscs: OscillatorNode[] = []
      const types: OscillatorType[] = i === 0 ? ['sine'] : ['sawtooth', 'triangle']
      types.forEach((type, k) => {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.value = mtof(m)
        o.detune.value = (k === 0 ? -7 : 7) + (Math.random() * 4 - 2)
        o.connect(g)
        o.start(t)
        oscs.push(o)
      })
      this.voices.push({ gain: g, oscs })
    })
  }

  private pluck(freq: number, t: number, vol: number, toMusic = false) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    o.type = 'sine'
    o2.type = 'triangle'
    o.frequency.value = freq
    o2.frequency.value = freq * 2.001
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    const g2 = ctx.createGain()
    g2.gain.value = 0.25
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(toMusic ? this.musicBus : this.sfxBus)
    g.connect(this.delaySend)
    g.connect(this.reverbSend)
    o.start(t)
    o2.start(t)
    o.stop(t + 1.7)
    o2.stop(t + 1.7)
  }

  /* --------------------------- Interaction --------------------------- */

  private ready() {
    return !!this.ctx && !this.muted && this.ctx.state === 'running'
  }

  /** Feed scroll velocity (0..1) to make the music react to movement. */
  pushEnergy(v: number) {
    this.energy = Math.min(1, Math.max(this.energy, v))
  }

  level() {
    if (!this.ctx || this.muted) return 0
    this.analyser.getByteFrequencyData(this.analyserData)
    let sum = 0
    for (let i = 0; i < 24; i++) sum += this.analyserData[i]
    return sum / (24 * 255)
  }

  hover() {
    if (!this.ready()) return
    const now = performance.now()
    if (now - this.lastHover < 45) return
    this.lastHover = now
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2200, t)
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.04)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    o.connect(g).connect(this.sfxBus)
    o.start(t)
    o.stop(t + 0.07)
  }

  click() {
    if (!this.ready()) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    ;[880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const g = ctx.createGain()
      const s = t + i * 0.045
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.12, s + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18)
      o.connect(g).connect(this.sfxBus)
      g.connect(this.reverbSend)
      o.start(s)
      o.stop(s + 0.2)
    })
  }

  whoosh(strength = 1) {
    if (!this.ready()) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const dur = 1.1
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(300, t)
    f.frequency.exponentialRampToValueAtTime(2800, t + dur * 0.55)
    f.frequency.exponentialRampToValueAtTime(500, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.09 * strength, t + dur * 0.5)
    g.gain.linearRampToValueAtTime(0, t + dur)
    src.connect(f).connect(g).connect(this.sfxBus)
    g.connect(this.reverbSend)
    src.start(t)
  }

  success() {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    ;[74, 78, 81, 86].forEach((m, i) => this.pluck(mtof(m), t + i * 0.07, 0.12))
  }

  /** Play the i-th note of an extended pentatonic scale. */
  note(i: number, vel = 1) {
    if (!this.ready()) return
    const oct = Math.floor(i / PENTA.length)
    const m = PENTA[i % PENTA.length] + 12 * (oct - 1)
    this.pluck(mtof(m), this.ctx!.currentTime, 0.12 * vel)
  }

  boot() {
    if (!this.ready()) return
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(40, t)
    o.frequency.exponentialRampToValueAtTime(110, t + 0.9)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.35, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    o.connect(g).connect(this.sfxBus)
    o.start(t)
    o.stop(t + 1.7)
    this.whoosh(1.4)
    ;[62, 69, 74, 78].forEach((m, i) => this.pluck(mtof(m), t + 0.25 + i * 0.12, 0.1))
  }
}

export const audio = new AudioEngine()
