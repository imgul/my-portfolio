/**
 * The audio "rig": master chain, music/SFX buses, reverb and delay.
 * It works with any BaseAudioContext, so the exact same code runs live in
 * the browser (AudioContext) and offline in the Sound Lab (OfflineAudioContext)
 * when we render preview files.
 */

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export interface FxSettings {
  reverbSeconds: number
  reverbDecay: number
  reverbLevel: number
  delayTime: number
  delayFeedback: number
  delayTone: number
  musicLevel: number
  sfxLevel: number
}

export interface Rig {
  ctx: BaseAudioContext
  /** Master gain (mute/unmute fades happen here). */
  master: GainNode
  musicBus: GainNode
  sfxBus: GainNode
  reverb: ConvolverNode
  reverbOut: GainNode
  reverbSend: GainNode
  delay: DelayNode
  delayFb: GainNode
  delayTone: BiquadFilterNode
  delaySend: GainNode
  analyser: AnalyserNode
}

export function createRig(ctx: BaseAudioContext, destination: AudioNode = ctx.destination): Rig {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 10
  comp.ratio.value = 4
  comp.attack.value = 0.004
  comp.release.value = 0.2
  comp.connect(destination)

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 25
  hp.connect(comp)

  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(hp)

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  master.connect(analyser)

  const musicBus = ctx.createGain()
  musicBus.connect(master)
  const sfxBus = ctx.createGain()
  sfxBus.connect(master)

  const reverb = ctx.createConvolver()
  const reverbOut = ctx.createGain()
  reverb.connect(reverbOut).connect(master)
  const reverbSend = ctx.createGain()
  reverbSend.connect(reverb)

  const delay = ctx.createDelay(2)
  const delayFb = ctx.createGain()
  const delayTone = ctx.createBiquadFilter()
  delayTone.type = 'lowpass'
  delay.connect(delayTone).connect(delayFb).connect(delay)
  const delayOut = ctx.createGain()
  delayOut.gain.value = 0.5
  delay.connect(delayOut).connect(master)
  delayOut.connect(reverbSend)
  const delaySend = ctx.createGain()
  delaySend.connect(delay)

  return { ctx, master, musicBus, sfxBus, reverb, reverbOut, reverbSend, delay, delayFb, delayTone, delaySend, analyser }
}

export function applyFx(rig: Rig, fx: FxSettings, t = rig.ctx.currentTime) {
  rig.reverb.buffer = impulse(rig.ctx, fx.reverbSeconds, fx.reverbDecay)
  rig.reverbOut.gain.setTargetAtTime(fx.reverbLevel, t, 0.1)
  rig.delay.delayTime.setTargetAtTime(fx.delayTime, t, 0.05)
  rig.delayFb.gain.setTargetAtTime(fx.delayFeedback, t, 0.05)
  rig.delayTone.frequency.setTargetAtTime(fx.delayTone, t, 0.05)
  rig.musicBus.gain.setTargetAtTime(fx.musicLevel, t, 0.3)
  rig.sfxBus.gain.setTargetAtTime(fx.sfxLevel, t, 0.1)
}

export function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
/** 2 seconds of cached white noise. */
export function noiseBuffer(ctx: BaseAudioContext) {
  let b = noiseCache.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, b)
  }
  return b
}

/** Percussive envelope: quick attack to `peak`, exponential decay. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, decay: number) {
  // Fresh GainNodes default to 1. Zero the intrinsic value so no sample leaks
  // through before the first automation event (audible as a click).
  p.value = 0
  p.cancelScheduledValues(t)
  p.setValueAtTime(0.0001, t)
  p.linearRampToValueAtTime(peak, t + attack)
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

export function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, detune = 0) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  return o
}

/** Play a short burst of filtered noise. Returns the gain node for extra routing. */
export function noiseHit(
  rig: Rig,
  t: number,
  opts: { type: BiquadFilterType; freq: number; q?: number; peak: number; attack?: number; decay: number; out: AudioNode; pan?: number },
) {
  const { ctx } = rig
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const f = ctx.createBiquadFilter()
  f.type = opts.type
  f.frequency.value = opts.freq
  f.Q.value = opts.q ?? 0.7
  const g = ctx.createGain()
  perc(g.gain, t, opts.peak, opts.attack ?? 0.002, opts.decay)
  let last: AudioNode = g
  if (opts.pan !== undefined) {
    const p = ctx.createStereoPanner()
    p.pan.value = opts.pan
    g.connect(p)
    last = p
  }
  src.connect(f).connect(g)
  last.connect(opts.out)
  const offset = Math.random() * 1.5
  src.start(t, offset, (opts.attack ?? 0.002) + opts.decay + 0.05)
  return last
}
