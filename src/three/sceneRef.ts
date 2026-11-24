import type { ParticleField } from './ParticleField'

/** Module-level handle so any component can drive the 3D scene. */
export const sceneRef: { current: ParticleField | null } = { current: null }
