/**
 * Point-cloud shapes, one per section. Each builder returns n × vec4:
 * xyz = rest position, w = a per-shape "tag" the vertex shader uses to animate
 * that point (orbit radius, page-turn flag, packet, leaf, arc progress, ...).
 * Keep the tag conventions in sync with the shader in ParticleField.ts.
 */
import * as THREE from 'three'

const rand = (a = -1, b = 1) => a + Math.random() * (b - a)
export const gauss = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const pick = <T,>(arr: T[], weights: number[]) => {
  let total = 0
  for (const w of weights) total += w
  let r = Math.random() * total
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]
    if (r <= 0) return arr[i]
  }
  return arr[arr.length - 1]
}

type Put = (x: number, y: number, z: number, w?: number) => void
function build(n: number, fn: (put: Put, i: number) => void) {
  const out = new Float32Array(n * 4)
  let i = 0
  const put: Put = (x, y, z, w = 0) => {
    out[i * 4] = x
    out[i * 4 + 1] = y
    out[i * 4 + 2] = z
    out[i * 4 + 3] = w
  }
  for (; i < n; i++) fn(put, i)
  return out
}

/* 0 · Intro: spiral galaxy. w = orbital radius (inner stars orbit faster). */
export function galaxy(n: number) {
  return build(n, (put, i) => {
    const k = Math.random()
    if (k < 0.16) {
      // bulge
      const x = gauss() * 0.42
      const y = gauss() * 0.26
      const z = gauss() * 0.42
      put(x, y, z, Math.hypot(x, z))
    } else if (k < 0.86) {
      const arm = (i % 2) * Math.PI
      const r = 0.35 + Math.pow(Math.random(), 0.85) * 4.3
      const th = arm + Math.log(r + 0.2) * 2.6
      const spread = 0.07 + 0.14 * (r / 4.6)
      const x = Math.cos(th) * r + gauss() * spread
      const z = Math.sin(th) * r + gauss() * spread
      put(x, gauss() * 0.07 * (1.6 - r / 4.6), z, r)
    } else {
      // diffuse disc + halo
      const r = Math.sqrt(Math.random()) * 5
      const th = Math.random() * Math.PI * 2
      put(Math.cos(th) * r, gauss() * 0.18, Math.sin(th) * r, r)
    }
  })
}

/* 1 · Manifesto: DNA double helix. w = 1 for base-pair rungs (light wave runs through them). */
export function dna(n: number) {
  const L = 7
  const R = 1.05
  const TURNS = 3
  const PAIRS = 30
  const at = (t: number, phase: number) => {
    const a = t * Math.PI * 2 * TURNS + phase
    return [Math.cos(a) * R, (t - 0.5) * L, Math.sin(a) * R]
  }
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.5) {
      const t = Math.random()
      const [x, y, z] = at(t, Math.random() < 0.5 ? 0 : Math.PI)
      put(x + gauss() * 0.06, y + gauss() * 0.04, z + gauss() * 0.06)
    } else if (k < 0.62) {
      // nucleotide beads on the backbone
      const step = Math.floor(Math.random() * PAIRS)
      const [x, y, z] = at((step + 0.5) / PAIRS, Math.random() < 0.5 ? 0 : Math.PI)
      put(x + gauss() * 0.1, y + gauss() * 0.1, z + gauss() * 0.1)
    } else if (k < 0.94) {
      const step = Math.floor(Math.random() * PAIRS)
      const t = (step + 0.5) / PAIRS
      const [ax, ay, az] = at(t, 0)
      const [bx, , bz] = at(t, Math.PI)
      let s = Math.random()
      if (Math.abs(s - 0.5) < 0.04) s += 0.08 // the hydrogen-bond gap
      put(ax + (bx - ax) * s + gauss() * 0.02, ay + gauss() * 0.02, az + (bz - az) * s + gauss() * 0.02, 1)
    } else {
      // floating aura
      const t = Math.random()
      const a = Math.random() * Math.PI * 2
      const r = R + 0.5 + Math.random() * 1.2
      put(Math.cos(a) * r, (t - 0.5) * L * 1.1, Math.sin(a) * r)
    }
  })
}

/* 2 · Journey: a winding road. w = 1 lane dashes (flow), 2 milestone pin heads (pulse). */
export const roadX = (z: number) => Math.sin(z * 0.45) * 1.6
export function road(n: number) {
  const Z0 = -5.6
  const Z1 = 1.8
  const HALF = 0.55
  const GROUND = -1.3
  const PINS = [-4.8, -3.3, -1.8, -0.3, 1.2]
  const hill = (x: number, z: number) => {
    const off = Math.abs(x - roadX(z))
    return GROUND + THREE.MathUtils.smoothstep(off, 0.9, 3.2) * (0.5 + 0.45 * Math.sin(x * 0.9 + z * 0.6) + 0.3 * Math.cos(z * 1.3))
  }
  return build(n, (put) => {
    const k = Math.random()
    const z = rand(Z0, Z1)
    if (k < 0.24) {
      const side = Math.random() < 0.5 ? -1 : 1
      put(roadX(z) + side * HALF + gauss() * 0.015, GROUND, z)
    } else if (k < 0.36) {
      const period = 1 / 1.2
      let zz = z
      if (((zz - Z0) / period) % 1 > 0.45) zz -= period * 0.5
      put(roadX(zz) + gauss() * 0.012, GROUND + 0.01, zz, 1)
    } else if (k < 0.44) {
      // asphalt texture
      put(roadX(z) + rand(-HALF, HALF), GROUND - 0.01, z)
    } else if (k < 0.52) {
      const pz = PINS[Math.floor(Math.random() * PINS.length)]
      const px = roadX(pz) + 0.95
      if (Math.random() < 0.35) put(px + gauss() * 0.012, GROUND + Math.random() * 0.95, pz + gauss() * 0.012)
      else {
        const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(0.17 * Math.cbrt(Math.random()))
        put(px + v.x, GROUND + 1.1 + v.y, pz + v.z, 2)
      }
    } else {
      // rolling countryside on both sides
      const x = rand(-4.6, 4.6)
      if (Math.abs(x - roadX(z)) < HALF + 0.15) {
        put(roadX(z) + (Math.random() < 0.5 ? -1 : 1) * (HALF + 0.2 + Math.random() * 0.3), GROUND, z)
      } else put(x, hill(x, z), z)
    }
  })
}

/* 3 · Ventures: a city skyline of boxes. w = 1 windows (flicker), 2/3 traffic along x/z. */
export function city(n: number) {
  const BASE = -1.2
  const CELL = 1.55
  type Bld = { x: number; z: number; w: number; d: number; h: number }
  const blds: Bld[] = []
  const heights = [1.1, 2.0, 1.4, 1.7, 3.1, 1.2, 0.8, 2.4, 1.5]
  for (let gx = -1; gx <= 1; gx++)
    for (let gz = -1; gz <= 1; gz++) {
      const h = heights[(gx + 1) * 3 + (gz + 1)]
      blds.push({ x: gx * CELL, z: gz * CELL, w: gx === 0 && gz === 0 ? 0.42 : rand(0.36, 0.46), d: gx === 0 && gz === 0 ? 0.42 : rand(0.36, 0.46), h })
    }
  const byHeight = blds.map((b) => b.h + 0.6)
  const lanes = [-1.5, -0.5, 0.5, 1.5].map((k) => k * CELL)
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.62) {
      // box edges
      const b = pick(blds, byHeight)
      const e = Math.floor(Math.random() * 12)
      const t = Math.random()
      const sx = e & 1 ? 1 : -1
      const sz = e & 2 ? 1 : -1
      const j = () => gauss() * 0.005
      if (e < 4) put(b.x + sx * b.w + j(), BASE + t * b.h, b.z + sz * b.d + j())
      else if (e < 8) put(b.x + (t * 2 - 1) * b.w, BASE + (e < 6 ? 0 : b.h) + j(), b.z + sz * b.d + j())
      else put(b.x + sx * b.w + j(), BASE + (e < 10 ? 0 : b.h) + j(), b.z + (t * 2 - 1) * b.d)
    } else if (k < 0.8) {
      // lit window grid on the facades
      const b = pick(blds, byHeight)
      const floors = Math.max(1, Math.floor((b.h - 0.15) / 0.2))
      const y = BASE + 0.15 + Math.floor(Math.random() * floors) * 0.2
      const face = Math.floor(Math.random() * 4)
      const cols = 4
      const c = ((Math.floor(Math.random() * cols) + 0.5) / cols) * 2 - 1
      const jy = rand(0, 0.05)
      const jx = rand(-0.035, 0.035)
      if (face < 2) put(b.x + c * b.w * 0.8 + jx, y + jy, b.z + (face ? 1 : -1) * b.d, 1)
      else put(b.x + (face === 2 ? 1 : -1) * b.w, y + jy, b.z + c * b.d * 0.8 + jx, 1)
    } else if (k < 0.85) {
      // rooftop antennas on the tallest towers
      const b = pick(blds, blds.map((x) => Math.pow(x.h, 4)))
      put(b.x + gauss() * 0.01, BASE + b.h + Math.random() * 0.45, b.z + gauss() * 0.01, Math.random() < 0.2 ? 1 : 0)
    } else if (k < 0.95) {
      // traffic in the streets
      const lane = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() < 0.5 ? -0.07 : 0.07)
      if (Math.random() < 0.5) put(rand(-3, 3), BASE + 0.02, lane, 2)
      else put(lane, BASE + 0.02, rand(-3, 3), 3)
    } else {
      // street grid
      const lane = lanes[Math.floor(Math.random() * lanes.length)]
      if (Math.random() < 0.5) put(rand(-3, 3), BASE, lane + (Math.random() < 0.5 ? -0.16 : 0.16))
      else put(lane + (Math.random() < 0.5 ? -0.16 : 0.16), BASE, rand(-3, 3))
    }
  })
}

/* 4 · Notes: an open book. w = 1 for the turning page, stored as (u 0..1, 0, v). */
export const BOOK_W = 2.4
const BOOK_D = 3.2
const BOOK_Y = -0.2
export const pageY = (u: number) => 0.35 * (1 - Math.exp(-u * 5))
export function book(n: number) {
  const rows = 15
  const lineLen = Array.from({ length: rows }, (_, r) => (r === rows - 1 || r === 6 ? rand(0.3, 0.55) : rand(0.75, 1)))
  const textPoint = () => {
    const r = Math.floor(Math.random() * rows)
    const u = 0.12 + Math.random() * 0.76 * lineLen[r]
    const v = -BOOK_D / 2 + 0.35 + r * ((BOOK_D - 0.7) / (rows - 1))
    return [u, v + gauss() * 0.012]
  }
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.58) {
      const side = Math.random() < 0.5 ? -1 : 1
      let u: number
      let v: number
      const q = Math.random()
      if (q < 0.62) [u, v] = textPoint()
      else if (q < 0.85) {
        u = Math.random()
        v = rand(-BOOK_D / 2, BOOK_D / 2)
      } else {
        // page outline
        const e = Math.random()
        if (e < 0.5) {
          u = Math.random()
          v = (Math.random() < 0.5 ? -1 : 1) * BOOK_D / 2
        } else {
          u = 1
          v = rand(-BOOK_D / 2, BOOK_D / 2)
        }
      }
      put(side * u * BOOK_W, BOOK_Y + pageY(u), v)
    } else if (k < 0.7) {
      // page block + cover
      const side = Math.random() < 0.5 ? -1 : 1
      if (Math.random() < 0.55) put(side * BOOK_W, BOOK_Y + rand(-0.22, pageY(1)), rand(-BOOK_D / 2, BOOK_D / 2))
      else {
        const e = Math.random()
        const cx = BOOK_W + 0.12
        const cz = BOOK_D / 2 + 0.12
        if (e < 0.5) put(rand(-cx, cx), BOOK_Y - 0.25, (Math.random() < 0.5 ? -1 : 1) * cz)
        else put(side * cx, BOOK_Y - 0.25, rand(-cz, cz))
      }
    } else {
      let u: number
      let v: number
      if (Math.random() < 0.55) [u, v] = textPoint()
      else {
        u = Math.random()
        v = rand(-BOOK_D / 2, BOOK_D / 2)
      }
      put(u, 0, v, 1)
    }
  })
}

/* 5 · Stack: floating layers of the stack. w = 1 data packets rising between layers. */
export function stack(n: number) {
  const S = 1.6
  const LAYERS = 5
  const rot = (x: number, z: number): [number, number] => [(x - z) * Math.SQRT1_2, (x + z) * Math.SQRT1_2]
  const pillars: [number, number][] = [
    [0, 0],
    [0.9, 0.9],
    [-0.9, 0.9],
    [0.9, -0.9],
    [-0.9, -0.9],
  ]
  const packets = Array.from({ length: 70 }, () => ({ p: pillars[Math.floor(Math.random() * pillars.length)], y: rand(-2.6, 2.6) }))
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.84) {
      const L = Math.floor(Math.random() * LAYERS)
      const y = (L - 2) * 1.0
      let x = 0
      let z = 0
      if (Math.random() < 0.3) {
        // double outline
        const inset = Math.random() < 0.7 ? 0 : 0.1
        const t = rand(-S + inset, S - inset)
        const e = Math.floor(Math.random() * 4)
        const edge = S - inset
        ;[x, z] = e === 0 ? [t, edge] : e === 1 ? [t, -edge] : e === 2 ? [edge, t] : [-edge, t]
      } else if (L === 0) {
        x = Math.round(rand(-S, S) / 0.2) * 0.2
        z = Math.round(rand(-S, S) / 0.2) * 0.2
      } else if (L === 1) {
        const ring = 1 + Math.floor(Math.random() * 4)
        const a = Math.random() * Math.PI * 2
        x = Math.cos(a) * ring * 0.36
        z = Math.sin(a) * ring * 0.36
      } else if (L === 2) {
        x = rand(-S + 0.15, S - 0.15)
        z = Math.round(rand(-S + 0.2, S - 0.2) / 0.28) * 0.28
      } else if (L === 3) {
        // chips
        const cx = Math.floor(Math.random() * 3) - 1
        const cz = Math.floor(Math.random() * 3) - 1
        const e = Math.random() < 0.5
        const t = rand(-0.3, 0.3)
        x = cx * 0.95 + (e ? t : (Math.random() < 0.5 ? -0.3 : 0.3))
        z = cz * 0.95 + (e ? (Math.random() < 0.5 ? -0.3 : 0.3) : t)
      } else {
        const a = (Math.floor(Math.random() * 16) / 16) * Math.PI * 2
        const r = Math.random() * 1.45
        x = Math.cos(a) * r
        z = Math.sin(a) * r
      }
      const [rx, rz] = rot(x, z)
      put(rx, y + gauss() * 0.01, rz)
    } else if (k < 0.97) {
      const pk = packets[Math.floor(Math.random() * packets.length)]
      const [rx, rz] = rot(pk.p[0], pk.p[1])
      put(rx + gauss() * 0.035, pk.y + gauss() * 0.06, rz + gauss() * 0.035, 1)
    } else {
      const p = pillars[Math.floor(Math.random() * pillars.length)]
      const [rx, rz] = rot(p[0], p[1])
      put(rx, rand(-2, 2), rz)
    }
  })
}

/* 6 · Agents: layered neural network. w = layer index + progress along the link (signals travel). */
export function neural(n: number) {
  const sizes = [4, 7, 9, 7, 3]
  const nodes = sizes.map((count, L) => {
    const x = -3.3 + (L / (sizes.length - 1)) * 6.6
    const r = count === 1 ? 0 : 0.27 * Math.pow(count, 0.85)
    return Array.from({ length: count }, (_, j) => {
      const a = (j / count) * Math.PI * 2 + L * 0.4
      return new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r)
    })
  })
  // each node links to 3 nodes of the next layer (crisper than all-to-all)
  const edges: [THREE.Vector3, THREE.Vector3, number][] = []
  for (let L = 0; L < sizes.length - 1; L++)
    nodes[L].forEach((a, j) => {
      const next = nodes[L + 1]
      const c = Math.round((j / nodes[L].length) * next.length)
      for (const o of [-1, 0, 1]) edges.push([a, next[(c + o + next.length) % next.length], L])
    })
  const tmp = new THREE.Vector3()
  return build(n, (put) => {
    if (Math.random() < 0.3) {
      const L = Math.floor(Math.random() * sizes.length)
      const nd = nodes[L][Math.floor(Math.random() * sizes[L])]
      const shell = Math.random() < 0.5
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(shell ? 0.16 : 0.09 * Math.random())
      put(nd.x + v.x, nd.y + v.y, nd.z + v.z, L)
    } else {
      const [a, b, L] = edges[Math.floor(Math.random() * edges.length)]
      const t = Math.random()
      tmp.copy(a).lerp(b, t)
      put(tmp.x + gauss() * 0.012, tmp.y + gauss() * 0.012, tmp.z + gauss() * 0.012, L + t)
    }
  })
}

/* 7 · Learning: a tree with roots. w = 1 leaves (sway), 2 falling leaves. */
export const TREE_GROUND = -1.3
export function tree(n: number) {
  type Seg = { a: THREE.Vector3; b: THREE.Vector3; r: number }
  const branches: Seg[] = []
  const roots: Seg[] = []
  const tips: THREE.Vector3[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const bend = (dir: THREE.Vector3, min: number, max: number) => {
    const axis = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(gauss(), gauss(), gauss())).normalize()
    return dir.clone().applyAxisAngle(axis, rand(min, max))
  }
  const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const b = a.clone().addScaledVector(dir, len)
    branches.push({ a, b, r })
    if (depth === 0) {
      tips.push(b)
      return
    }
    const kids = depth > 3 ? 2 + (Math.random() < 0.4 ? 1 : 0) : 2
    for (let i = 0; i < kids; i++) {
      const d = bend(dir, 0.55, 1.0).lerp(up, 0.08).normalize()
      grow(b, d, len * rand(0.68, 0.8), r * 0.68, depth - 1)
    }
    if (depth < 3) tips.push(b)
  }
  const root = (a: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const b = a.clone().addScaledVector(dir, len)
    roots.push({ a, b, r })
    if (depth === 0) return
    for (let i = 0; i < 2; i++) {
      const d = bend(dir, 0.3, 0.8)
      d.y = Math.min(d.y, -0.15) * 0.7
      root(b, d.normalize(), len * 0.72, r * 0.62, depth - 1)
    }
  }
  const base = new THREE.Vector3(0, TREE_GROUND, 0)
  grow(base, up.clone(), 0.95, 0.2, 5)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand(-0.3, 0.3)
    root(base.clone(), new THREE.Vector3(Math.cos(a) * 1.1, -1, Math.sin(a) * 1.1).normalize(), 0.45, 0.12, 3)
  }
  const lenOf = (s: Seg) => s.a.distanceTo(s.b) * (0.25 + s.r * 12)
  const bW = branches.map(lenOf)
  const rW = roots.map(lenOf)
  const onSeg = (s: Seg, put: Put) => {
    const t = Math.random()
    const p = s.a.clone().lerp(s.b, t)
    const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(s.r * Math.sqrt(Math.random()))
    put(p.x + v.x, p.y + v.y, p.z + v.z)
  }
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.3) onSeg(pick(branches, bW), put)
    else if (k < 0.72) {
      const tip = tips[Math.floor(Math.random() * tips.length)]
      put(tip.x + gauss() * 0.36, tip.y + gauss() * 0.26, tip.z + gauss() * 0.36, 1)
    } else if (k < 0.85) onSeg(pick(roots, rW), put)
    else if (k < 0.95) {
      // ground: soft rings around the trunk
      const r = 0.3 + Math.pow(Math.random(), 0.7) * 2.6
      const a = Math.random() * Math.PI * 2
      put(Math.cos(a) * r, TREE_GROUND + gauss() * 0.01, Math.sin(a) * r)
    } else {
      const tip = tips[Math.floor(Math.random() * tips.length)]
      put(tip.x + gauss() * 0.4, rand(TREE_GROUND, 2.4), tip.z + gauss() * 0.4, 2)
    }
  })
}

/* 8 · Beyond: Margalla Hills. w = 1 + s for the trail (sparkle climbs it), 3 for the sun. */
export function mountains(n: number) {
  const BASE = -1.8
  const ranges = [
    { z: -2.2, amp: 2.9, ph: 0.3, f: 0.55 },
    { z: -0.7, amp: 2.0, ph: 2.1, f: 0.7 },
    { z: 0.8, amp: 1.1, ph: 4.0, f: 0.9 },
  ]
  const H = (rg: (typeof ranges)[number], x: number) => {
    const a = Math.pow(1 - Math.abs(Math.sin(x * rg.f * 0.5 + rg.ph)), 1.6)
    const b = Math.pow(1 - Math.abs(Math.sin(x * rg.f * 1.3 + rg.ph * 2.3)), 2.2)
    const fade = THREE.MathUtils.smoothstep(6.6 - Math.abs(x), 0, 2.2)
    return rg.amp * (0.25 + 0.55 * a + 0.25 * b) * fade
  }
  const SPREAD = 1.25
  const surf = (rg: (typeof ranges)[number], x: number, d: number) => BASE + H(rg, x) * Math.pow(1 - Math.min(1, Math.abs(d) / SPREAD), 1.4)
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.58) {
      const rg = ranges[Math.floor(Math.random() * ranges.length)]
      const x = rand(-6.5, 6.5)
      const d = rand(-SPREAD, SPREAD)
      put(x, surf(rg, x, d) + gauss() * 0.01, rg.z + d)
    } else if (k < 0.8) {
      // crest lines
      const rg = ranges[Math.floor(Math.random() * ranges.length)]
      const x = rand(-6.5, 6.5)
      put(x, BASE + H(rg, x), rg.z + gauss() * 0.02)
    } else if (k < 0.86) {
      // a switchback trail climbing the middle range
      const s = Math.random() * 0.999
      const rg = ranges[1]
      const x = -0.6 + s * 1.4 + 0.35 * Math.sin(s * 16)
      const d = SPREAD * (1 - s) * 0.95
      put(x, surf(rg, x, d) + 0.03, rg.z + d, 1 + s)
    } else if (k < 0.96) {
      const r = Math.random() < 0.55 ? 0.85 + gauss() * 0.02 : 0.85 * Math.sqrt(Math.random())
      const a = Math.random() * Math.PI * 2
      put(2.6 + Math.cos(a) * r, 1.3 + Math.sin(a) * r, -3.8, 3)
    } else if (Math.random() < 0.4) {
      // valley mist
      put(rand(-6, 6), BASE + Math.random() * 0.35, rand(-3, 2))
    } else {
      // a few stars above the ridgeline
      put(rand(-6.5, 6.5), rand(0.9, 3.2), -4.4 + gauss() * 0.3)
    }
  })
}

/* 9 · Contact: a globe with arcs from Islamabad. w = 1 + t along an arc, 3 for city lights. */
const ISB: [number, number] = [33.7, 73.1]
const CITIES: [number, number][] = [
  [25.2, 55.3], // Dubai
  [24.7, 46.7], // Riyadh
  [25.3, 51.5], // Doha
  [51.5, -0.1], // London
  [52.5, 13.4], // Berlin
  [40.7, -74], // New York
  [43.7, -79.4], // Toronto
  [37.8, -122.4], // San Francisco
  [1.35, 103.8], // Singapore
  [-33.9, 151.2], // Sydney
]
export function globe(n: number) {
  const R = 2.1
  const LON0 = 60
  const vec = (lat: number, lon: number, r = R) => {
    const la = THREE.MathUtils.degToRad(lat)
    const lo = THREE.MathUtils.degToRad(lon - LON0)
    return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo))
  }
  const home = vec(ISB[0], ISB[1]).normalize()
  const tmp = new THREE.Vector3()
  return build(n, (put) => {
    const k = Math.random()
    if (k < 0.42) {
      // graticule
      if (Math.random() < 0.5) {
        const lat = (Math.floor(Math.random() * 11) - 5) * 15
        const p = vec(lat, Math.random() * 360)
        put(p.x, p.y, p.z)
      } else {
        const lon = Math.floor(Math.random() * 24) * 15
        const p = vec(Math.asin(rand(-1, 1)) * (180 / Math.PI), lon)
        put(p.x, p.y, p.z)
      }
    } else if (k < 0.64) {
      const p = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(R * (0.985 + Math.random() * 0.02))
      put(p.x, p.y, p.z)
    } else if (k < 0.86) {
      const c = CITIES[Math.floor(Math.random() * CITIES.length)]
      const dest = vec(c[0], c[1]).normalize()
      const t = Math.random()
      const ang = home.angleTo(dest)
      // slerp along the great circle, lifted off the surface
      const s0 = Math.sin((1 - t) * ang) / Math.sin(ang)
      const s1 = Math.sin(t * ang) / Math.sin(ang)
      tmp.copy(home).multiplyScalar(s0).addScaledVector(dest, s1)
      tmp.multiplyScalar(R * (1 + Math.sin(Math.PI * t) * 0.18 * ang))
      put(tmp.x, tmp.y, tmp.z, 1 + t * 0.999)
    } else if (k < 0.95) {
      const isHome = Math.random() < 0.35
      const c = isHome ? ISB : CITIES[Math.floor(Math.random() * CITIES.length)]
      const p = vec(c[0], c[1], R * 1.01)
      const s = isHome ? 0.12 : 0.06
      put(p.x + gauss() * s, p.y + gauss() * s, p.z + gauss() * s, 3)
    } else {
      // tilted orbit ring
      const a = Math.random() * Math.PI * 2
      const r = R * 1.3 + gauss() * 0.015
      const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), 0.5)
      put(p.x, p.y, p.z)
    }
  })
}

export const BUILDERS = [galaxy, dna, road, city, book, stack, neural, tree, mountains, globe]
