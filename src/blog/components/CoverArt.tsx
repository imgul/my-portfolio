/**
 * Generative dotted cover art, echoing the portfolio's 3D point clouds.
 * Deterministic per post (seeded by slug), pure SVG, no image files.
 */
import { memo, useId } from 'react'
import type { Art } from '../data'
import { useHydrated } from '../hydrated'

type Pt = [number, number, number] // x, y (0..1), size

function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = (h << 13) | (h >>> 19)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GEN: Record<Art, (r: () => number) => Pt[]> = {
  galaxy(r) {
    const out: Pt[] = []
    for (let i = 0; i < 700; i++) {
      const arm = i % 3
      const d = Math.pow(r(), 0.7)
      const a = (arm * Math.PI * 2) / 3 + d * 7 + (r() - 0.5) * 0.6
      out.push([0.62 + Math.cos(a) * d * 0.36, 0.5 + Math.sin(a) * d * 0.4 * 0.55, (1 - d) * 2 + 0.6])
    }
    for (let i = 0; i < 60; i++) out.push([r(), r(), 0.6])
    return out
  },
  dna(r) {
    const out: Pt[] = []
    for (let i = 0; i < 260; i++) {
      const x = 0.08 + (i / 260) * 0.84
      const ph = x * 18
      out.push([x, 0.5 + Math.sin(ph) * 0.2, 1.4 + Math.cos(ph)])
      out.push([x, 0.5 - Math.sin(ph) * 0.2, 1.4 - Math.cos(ph)])
      if (i % 9 === 0) for (let k = 0; k < 8; k++) out.push([x, 0.5 + Math.sin(ph) * 0.2 * (1 - (k / 7) * 2), 0.7])
    }
    return out.map(([x, y, s]) => [x + (r() - 0.5) * 0.004, y, s])
  },
  road(r) {
    const out: Pt[] = []
    for (let i = 0; i < 300; i++) {
      const t = i / 300
      const y = 0.95 - t * 0.6
      const c = 0.5 + Math.sin(t * 5) * 0.18 * t
      const w = 0.3 * (1 - t) + 0.01
      out.push([c - w, y, 1.6 - t])
      out.push([c + w, y, 1.6 - t])
      if (i % 6 < 3) out.push([c, y, 1.1 - t * 0.6])
    }
    ;[0.15, 0.4, 0.7].forEach((t) => {
      const y = 0.95 - t * 0.6
      const c = 0.5 + Math.sin(t * 5) * 0.18 * t + 0.3 * (1 - t) + 0.05
      for (let k = 0; k < 14; k++) out.push([c + Math.cos(k) * 0.012, y - 0.06 + Math.sin(k) * 0.02, 1.4])
    })
    for (let i = 0; i < 80; i++) out.push([r(), r() * 0.3, 0.6])
    return out
  },
  city(r) {
    const out: Pt[] = []
    let x = 0.05
    while (x < 0.95) {
      const w = 0.04 + r() * 0.06
      const h = 0.15 + r() * 0.5
      for (let y = 0.9; y > 0.9 - h; y -= 0.025) for (let xx = x + 0.008; xx < x + w - 0.004; xx += 0.014) if (r() < 0.55) out.push([xx, y, r() < 0.15 ? 2 : 1])
      x += w + 0.012
    }
    return out
  },
  book(r) {
    const out: Pt[] = []
    for (let side = -1; side <= 1; side += 2)
      for (let l = 0; l < 14; l++)
        for (let i = 0; i < 40; i++) {
          const t = i / 39
          const x = 0.5 + side * (0.02 + t * 0.34)
          const y = 0.3 + l * 0.032 + Math.sin(t * Math.PI) * 0.03 * -1 + t * t * 0.02
          out.push([x, y, l === 0 ? 1.6 : 0.9 + r() * 0.3])
        }
    for (let i = 0; i < 40; i++) out.push([0.5, 0.28 + i * 0.012, 1.2])
    return out
  },
  stack(r) {
    const out: Pt[] = []
    for (let l = 0; l < 4; l++) {
      const cy = 0.78 - l * 0.16
      for (let i = 0; i < 160; i++) {
        const u = r() * 2 - 1
        const v = r() * 2 - 1
        out.push([0.5 + (u - v) * 0.2, cy + (u + v) * 0.06, l === 3 ? 1.5 : 1])
      }
    }
    return out
  },
  network(r) {
    const out: Pt[] = []
    const layers = [4, 6, 6, 3]
    const nodes = layers.map((n, li) => Array.from({ length: n }, (_, k) => [0.15 + (li / (layers.length - 1)) * 0.7, 0.5 + (k - (n - 1) / 2) * 0.12] as const))
    nodes.forEach((layer, li) => {
      layer.forEach(([x, y]) => {
        for (let k = 0; k < 12; k++) out.push([x + Math.cos(k) * 0.012, y + Math.sin(k) * 0.02, 1.8])
        if (li < nodes.length - 1)
          nodes[li + 1].forEach(([x2, y2]) => {
            if (r() < 0.6) for (let t = 0.1; t < 0.9; t += 0.06) out.push([x + (x2 - x) * t, y + (y2 - y) * t, 0.6])
          })
      })
    })
    return out
  },
  tree(r) {
    const out: Pt[] = []
    const branch = (x: number, y: number, a: number, len: number, d: number) => {
      const x2 = x + Math.cos(a) * len * 0.6
      const y2 = y - Math.sin(a) * len
      for (let t = 0; t < 1; t += 0.06) out.push([x + (x2 - x) * t, y + (y2 - y) * t, 2.2 - d * 0.35])
      if (d < 5) {
        branch(x2, y2, a + 0.45 + r() * 0.2, len * 0.72, d + 1)
        branch(x2, y2, a - 0.45 - r() * 0.2, len * 0.72, d + 1)
      } else for (let k = 0; k < 6; k++) out.push([x2 + (r() - 0.5) * 0.05, y2 + (r() - 0.5) * 0.06, 1.2])
    }
    branch(0.5, 0.95, Math.PI / 2, 0.22, 0)
    return out
  },
  mountains(r) {
    const out: Pt[] = []
    for (let l = 0; l < 3; l++)
      for (let i = 0; i < 220; i++) {
        const x = i / 219
        const y = 0.55 + l * 0.12 - Math.abs(Math.sin(x * (3 + l) + l)) * (0.22 - l * 0.05) - Math.sin(x * 13 + l) * 0.015
        out.push([x, y, 1.6 - l * 0.3])
        if (r() < 0.25) out.push([x, y + r() * 0.2, 0.6])
      }
    for (let k = 0; k < 40; k++) out.push([0.75 + Math.cos(k / 6.4) * 0.05, 0.22 + Math.sin(k / 6.4) * 0.09, 1.4])
    return out
  },
  globe(r) {
    const out: Pt[] = []
    const R = 0.36
    for (let lat = -75; lat <= 75; lat += 15)
      for (let lon = 0; lon < 360; lon += 4) {
        const la = (lat * Math.PI) / 180
        const lo = (lon * Math.PI) / 180
        const z = Math.cos(la) * Math.cos(lo)
        if (z < 0) continue
        out.push([0.5 + Math.cos(la) * Math.sin(lo) * R * 0.56, 0.5 - Math.sin(la) * R, 0.6 + z])
      }
    for (let a = 0; a < 3; a++) {
      const tx = 0.3 + r() * 0.4
      for (let t = 0; t <= 1; t += 0.03) out.push([0.56 + (tx - 0.56) * t, 0.42 - Math.sin(t * Math.PI) * 0.18 + (0.5 - 0.42) * t, 1.4])
    }
    return out
  },
}

/** `bg` / `second` default to CSS variables; pass real colours for static rendering (OG images). */
export function CoverArtSvg({ art, seed, color, className, bg = 'var(--cover-bg)', second = 'var(--cover-2, #5b8cff)' }: { art: Art; seed: string; color: string; className?: string; bg?: string; second?: string }) {
  const pts = (GEN[art] ?? GEN.galaxy)(rng(seed))
  const id = `g${useId().replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg className={`cover-art ${className ?? ''}`} viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={second} />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill={bg} />
      <g fill={`url(#${id})`}>
        {pts.map(([x, y, s], i) => (
          <circle key={i} cx={(x * 1200).toFixed(1)} cy={(y * 630).toFixed(1)} r={(s * 1.9).toFixed(2)} opacity={Math.min(1, 0.35 + s * 0.3).toFixed(2)} />
        ))}
      </g>
    </svg>
  )
}

/**
 * Pre-rendered HTML gets a light gradient placeholder (hundreds of dots per
 * cover would bloat the page); the dots draw in right after hydration.
 */
function CoverArtImpl(props: { art: Art; seed: string; color: string; className?: string }) {
  const hydrated = useHydrated()
  if (!hydrated) return <span className={`cover-art is-placeholder ${props.className ?? ''}`} style={{ ['--c' as string]: props.color }} aria-hidden="true" />
  return <CoverArtSvg {...props} />
}

export const CoverArt = memo(CoverArtImpl)
