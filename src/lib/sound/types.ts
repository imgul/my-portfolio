import type { FxSettings, Rig } from './rig'
import type { Scene } from './scenes'

/**
 * A sound theme = background music + a full set of UI sound effects.
 * `tick` is called roughly every 100ms (live) and must schedule every event
 * that starts before `horizon`, using audio-clock times.
 */
export interface Theme {
  fx: FxSettings
  /** Tempo, used to lock ambience (clock ticks, data chatter) to the groove. */
  bpm: number
  /** Scale for the ambient textures (wind, birds, clock…). 0 = none. Default 0.6. */
  ambience?: number
  /** Play a signature motif on section changes. Default true. */
  stingers?: boolean
  /** Re-arrange for a section: crossfade layers, queue a key change, etc. */
  scene(rig: Rig, scene: Scene, t: number): void
  start(rig: Rig, t: number): void
  tick(rig: Rig, now: number, horizon: number, energy: number): void
  stop(rig: Rig, t: number): void
  sfx: {
    hover(rig: Rig, t: number): void
    click(rig: Rig, t: number): void
    whoosh(rig: Rig, t: number, strength: number): void
    success(rig: Rig, t: number): void
    note(rig: Rig, t: number, i: number, vel: number): void
    boot(rig: Rig, t: number): void
  }
}

export interface ThemeInfo {
  id: string
  name: string
  tagline: string
  create: () => Theme
}
