import type { LayerName } from './rig'

export type AmbienceName = 'air' | 'birds' | 'clock' | 'data' | 'vinyl'

/**
 * A scene is the musical arrangement for one section of the site.
 * Every theme reads the same scene and interprets it with its own instruments:
 *  - layers: which parts of the band play (0..1 each, crossfaded)
 *  - drive:  how much groove keeps going even when you stop scrolling
 *  - bright: tone of the whole music bus (lowpass)
 *  - space:  how much reverb
 *  - key:    transposition in semitones, applied at the next chord change
 *  - amb:    ambient sound textures layered on top
 */
export interface Scene {
  name: string
  mood: string
  layers: Record<LayerName, number>
  drive: number
  bright: number
  space: number
  key: number
  amb: Partial<Record<AmbienceName, number>>
}

const L = (pad: number, bass: number, drums: number, perc: number, arp: number, lead: number) => ({ pad, bass, drums, perc, arp, lead })

export const SCENES: Scene[] = [
  { name: 'Intro', mood: 'Arrival', layers: L(1, 0.45, 0, 0, 0.35, 0), drive: 0, bright: 0.5, space: 1.1, key: 0, amb: { air: 0.55 } },
  { name: 'Manifesto', mood: 'Conviction', layers: L(1, 1, 0.55, 0.2, 0.5, 0.35), drive: 0.25, bright: 0.62, space: 1, key: 0, amb: {} },
  { name: 'Journey', mood: 'On the road', layers: L(0.8, 1, 0.8, 0.7, 1, 0.3), drive: 0.45, bright: 0.75, space: 0.9, key: 2, amb: { clock: 0.6 } },
  { name: 'Ventures', mood: 'Build mode', layers: L(0.9, 1, 1, 1, 1, 0.75), drive: 0.7, bright: 1, space: 0.85, key: 5, amb: { data: 0.25 } },
  { name: 'Notes', mood: 'Reflection', layers: L(1, 0.5, 0, 0, 0.25, 0.8), drive: 0, bright: 0.38, space: 1.35, key: -3, amb: { vinyl: 0.7 } },
  { name: 'Stack', mood: 'Machinery', layers: L(0.6, 1, 1, 1, 1, 0), drive: 0.6, bright: 0.86, space: 0.75, key: 2, amb: { data: 0.55 } },
  { name: 'Agents', mood: 'Many minds', layers: L(0.75, 0.8, 0.6, 1, 1, 0.45), drive: 0.5, bright: 0.92, space: 1, key: -2, amb: { data: 1 } },
  { name: 'Learning', mood: 'Roots', layers: L(1, 0.6, 0.3, 0.35, 0.5, 0.65), drive: 0.2, bright: 0.55, space: 1.1, key: -5, amb: { vinyl: 0.45 } },
  { name: 'Beyond', mood: 'Open air', layers: L(1, 0.4, 0.2, 0.35, 0.4, 0.75), drive: 0.15, bright: 0.62, space: 1.4, key: -3, amb: { air: 0.7, birds: 0.9 } },
  { name: 'Contact', mood: 'Home', layers: L(1, 1, 0.75, 0.6, 0.75, 0.6), drive: 0.45, bright: 0.82, space: 1, key: 0, amb: { air: 0.3 } },
]

/** Scene brightness (0..1) → lowpass cutoff on the music bus. */
export const brightToHz = (b: number) => 900 * Math.pow(22, Math.max(0, Math.min(1, b)))
