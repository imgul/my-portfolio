import type { ThemeInfo } from './types'
import { createOriginal } from './themes/original'
import { createPulse } from './themes/pulse'
import { createDawn } from './themes/dawn'
import { createLofi } from './themes/lofi'
import { createFocus } from './themes/focus'
import { createSoundtrack, SOUNDTRACK_TITLES } from './themes/soundtrack'

export const THEMES: ThemeInfo[] = [
  {
    id: 'soundtrack',
    name: 'Soundtrack',
    tagline: 'A different piece for every section: Interstellar organ, strings, guitar, Bach, nature…',
    tracks: SOUNDTRACK_TITLES,
    create: createSoundtrack,
  },
  { id: 'focus', name: 'Deep Focus', tagline: 'Calm reading music: warm pad + felt piano, no drums, no noise', create: createFocus },
  { id: 'original', name: 'Original', tagline: 'Ambient pad + pentatonic music box', create: createOriginal },
  { id: 'pulse', name: 'A · Neon Pulse', tagline: 'Warm synthwave groove, 96 BPM, A minor', create: createPulse },
  { id: 'dawn', name: 'B · Margalla Dawn', tagline: 'Tanpura, Rhodes & bansuri, 70 BPM, D Yaman', create: createDawn },
  { id: 'lofi', name: 'C · Night Shift', tagline: 'Lo-fi hip-hop: wobbly Rhodes, boom-bap & music box, 80 BPM', create: createLofi },
]

export const DEFAULT_THEME = 'soundtrack'

export const getTheme = (id: string | null | undefined) => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!

export * from './rig'
export { Conductor } from './conductor'
export { SCENES, type Scene } from './scenes'
export type { Theme, ThemeInfo } from './types'
