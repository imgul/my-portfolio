import type { FxSettings, Rig } from './rig'

/**
 * A sound theme = background music + a full set of UI sound effects.
 * `tick` is called roughly every 100ms (live) and must schedule every event
 * that starts before `horizon`, using audio-clock times.
 */
export interface Theme {
  fx: FxSettings
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
