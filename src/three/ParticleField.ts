import * as THREE from 'three'
import { gsap } from 'gsap'
import { audio } from '../lib/audio'
import { scrollState } from '../lib/scroll'

/**
 * A single GPU particle system that morphs between "chapters" of the story:
 * 0 core sphere · 1 torus knot (systems) · 2 terrain (journey / hills)
 * 3 galaxy (ventures) · 4 double helix (stack) · 5 neural constellation (agents)
 * 6 the word "GUL" (contact).
 * Morphing, noise, mouse repulsion, scroll turbulence and audio reactivity
 * all happen in the vertex shader.
 */

export const SHAPES = 7

const PALETTES: [string, string][] = [
  ['#c6ff3d', '#5b8cff'], // core
  ['#5b8cff', '#c46bff'], // systems
  ['#3dffb5', '#c6ff3d'], // hills
  ['#ff6b3d', '#c46bff'], // galaxy
  ['#3dd6ff', '#c6ff3d'], // helix
  ['#c46bff', '#3dd6ff'], // neural
  ['#c6ff3d', '#ffffff'], // GUL
]

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uMorph;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uAudio;
  uniform float uTurb;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  uniform vec3 uPalA[${SHAPES}];
  uniform vec3 uPalB[${SHAPES}];
  attribute vec3 aS1;
  attribute vec3 aS2;
  attribute vec3 aS3;
  attribute vec3 aS4;
  attribute vec3 aS5;
  attribute vec3 aS6;
  attribute vec3 aRnd;
  varying vec3 vColor;
  varying float vAlpha;

  float w(float i) { return clamp(1.0 - abs(uMorph - i), 0.0, 1.0); }

  void main() {
    float w0 = w(0.0), w1 = w(1.0), w2 = w(2.0), w3 = w(3.0), w4 = w(4.0), w5 = w(5.0), w6 = w(6.0);
    vec3 p = position * w0 + aS1 * w1 + aS2 * w2 + aS3 * w3 + aS4 * w4 + aS5 * w5 + aS6 * w6;

    // Transition turbulence: particles scatter mid-morph and re-form.
    float fr = fract(uMorph);
    float trans = sin(fr * 3.14159);
    float t = uTime * 0.6 + aRnd.x * 6.2831;
    vec3 swirl = vec3(
      sin(p.y * 1.7 + t) + cos(p.z * 0.9 + t * 0.7),
      sin(p.z * 1.3 + t * 1.1) + cos(p.x * 1.1 - t * 0.6),
      sin(p.x * 1.5 + t * 0.9) + cos(p.y * 1.2 + t * 0.8)
    );
    float idle = 0.035 + uTurb * 0.25 + uAudio * 0.25;
    p += swirl * (idle + trans * 0.55 * (0.4 + aRnd.y));

    // Hills breathe like terrain under wind.
    p.y += w2 * sin(p.x * 0.8 + uTime * 0.6) * cos(p.z * 0.7 + uTime * 0.4) * 0.18;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Mouse repulsion in view space.
    float depth = -mv.z;
    vec2 m = uMouse * depth * vec2(0.4142 * uAspect, 0.4142);
    vec2 d = mv.xy - m;
    float dist = length(d);
    float force = smoothstep(1.6, 0.0, dist) * uMouseStrength;
    mv.xy += normalize(d + 0.0001) * force * 0.9;
    mv.z += force * 0.6;

    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.35 + aRnd.z) * (1.0 + uAudio * 1.4 + force * 1.5);
    gl_PointSize = size * uPixelRatio / depth;

    vec3 a = uPalA[0]*w0 + uPalA[1]*w1 + uPalA[2]*w2 + uPalA[3]*w3 + uPalA[4]*w4 + uPalA[5]*w5 + uPalA[6]*w6;
    vec3 b = uPalB[0]*w0 + uPalB[1]*w1 + uPalB[2]*w2 + uPalB[3]*w3 + uPalB[4]*w4 + uPalB[5]*w5 + uPalB[6]*w6;
    float mixer = clamp(aRnd.y * 0.7 + (p.y + 2.0) * 0.12, 0.0, 1.0);
    vColor = mix(a, b, mixer) + force * 0.6;
    vAlpha = (0.35 + aRnd.z * 0.65) * smoothstep(22.0, 3.0, depth);
  }
`

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, r);
    float core = smoothstep(0.18, 0.0, r);
    gl_FragColor = vec4(vColor * (glow * 0.8 + core * 0.9) * uOpacity, (glow * 0.6 + core) * vAlpha * uOpacity);
  }
`

/* ------------------------------ Shape builders ------------------------------ */

const rand = (a = -1, b = 1) => a + Math.random() * (b - a)
const gauss = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function sphere(n: number) {
  const out = new Float32Array(n * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const shell = Math.random() < 0.82
    const y = 1 - (i / (n - 1)) * 2
    const rad = Math.sqrt(1 - y * y)
    const th = golden * i
    const R = shell ? 2.2 + gauss() * 0.03 : Math.cbrt(Math.random()) * 1.9
    out.set([Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R], i * 3)
  }
  return out
}

function torusKnot(n: number) {
  const out = new Float32Array(n * 3)
  const p = 2
  const q = 3
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2 * p
    const r = 1.35 + 0.55 * Math.cos((q / p) * u)
    const cx = r * Math.cos(u)
    const cy = r * Math.sin(u)
    const cz = 0.55 * Math.sin((q / p) * u)
    const tube = 0.32 * Math.sqrt(Math.random())
    const a = Math.random() * Math.PI * 2
    out.set([cx + Math.cos(a) * tube, cy + Math.sin(a) * tube, cz + rand() * tube], i * 3)
  }
  return out
}

function terrain(n: number) {
  const out = new Float32Array(n * 3)
  const cols = Math.ceil(Math.sqrt(n * 1.6))
  const rows = Math.ceil(n / cols)
  for (let i = 0; i < n; i++) {
    const cx = i % cols
    const cz = Math.floor(i / cols)
    const x = (cx / cols - 0.5) * 13
    const z = (cz / rows - 0.5) * 8
    const ridge = Math.exp(-Math.pow((z + 1.5) / 1.8, 2))
    const h =
      Math.sin(x * 0.55) * 0.6 * ridge +
      Math.sin(x * 1.3 + z) * 0.25 +
      Math.cos(z * 0.9 - x * 0.4) * 0.3 +
      ridge * (1.4 + Math.sin(x * 0.9) * 0.8)
    out.set([x + rand(-0.02, 0.02), h - 1.6, z], i * 3)
  }
  return out
}

function galaxy(n: number) {
  const out = new Float32Array(n * 3)
  const arms = 4
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 1.6) * 4.6
    const arm = (i % arms) * ((Math.PI * 2) / arms)
    const spin = r * 1.05
    const spread = 0.35 * (1 - r / 6)
    const x = Math.cos(arm + spin) * r + gauss() * spread
    const z = Math.sin(arm + spin) * r + gauss() * spread
    const y = gauss() * 0.12 * (1.4 - r / 4.6)
    out.set([x, y, z], i * 3)
  }
  return out
}

function helix(n: number) {
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const t = Math.random()
    const y = (t - 0.5) * 7.5
    const a = t * Math.PI * 7
    const kind = Math.random()
    if (kind < 0.8) {
      const strand = kind < 0.4 ? 0 : Math.PI
      const R = 1.15 + gauss() * 0.05
      out.set([Math.cos(a + strand) * R, y, Math.sin(a + strand) * R], i * 3)
    } else {
      // rungs
      const s = rand(-1, 1)
      const step = Math.round(t * 46) / 46
      const yy = (step - 0.5) * 7.5
      const aa = step * Math.PI * 7
      out.set([Math.cos(aa) * 1.15 * s, yy, Math.sin(aa) * 1.15 * s], i * 3)
    }
  }
  return out
}

function neural(n: number) {
  const out = new Float32Array(n * 3)
  const nodes: THREE.Vector3[] = []
  const NN = 36
  for (let i = 0; i < NN; i++) {
    const v = new THREE.Vector3(gauss(), gauss() * 0.7, gauss()).normalize().multiplyScalar(rand(1.2, 3))
    nodes.push(v)
  }
  nodes[0].set(0, 0, 0)
  const tmp = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    const k = Math.random()
    if (k < 0.45) {
      const nd = nodes[Math.floor(Math.random() * NN)]
      const s = nd.lengthSq() < 0.01 ? 0.35 : 0.14
      out.set([nd.x + gauss() * s, nd.y + gauss() * s, nd.z + gauss() * s], i * 3)
    } else {
      // synapses: points along edges, hub-and-spoke + neighbour links
      const a = nodes[Math.floor(Math.random() * NN)]
      const b = Math.random() < 0.5 ? nodes[0] : nodes[(nodes.indexOf(a) + 1 + Math.floor(Math.random() * 3)) % NN]
      tmp.copy(a).lerp(b, Math.random())
      out.set([tmp.x + gauss() * 0.02, tmp.y + gauss() * 0.02, tmp.z + gauss() * 0.02], i * 3)
    }
  }
  return out
}

function textShape(n: number, word = 'GUL') {
  const out = new Float32Array(n * 3)
  const W = 600
  const H = 240
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 200px Syne, system-ui, sans-serif'
  g.fillText(word, W / 2, H / 2 + 8)
  const data = g.getImageData(0, 0, W, H).data
  const pts: number[] = []
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y)
  const count = pts.length / 2
  for (let i = 0; i < n; i++) {
    if (count === 0) {
      out.set([rand(-3, 3), rand(-1, 1), 0], i * 3)
      continue
    }
    const j = Math.floor(Math.random() * count)
    const x = ((pts[j * 2] - W / 2) / W) * 7.6
    const y = -((pts[j * 2 + 1] - H / 2) / W) * 7.6
    out.set([x + rand(-0.015, 0.015), y + 0.2, gauss() * 0.12], i * 3)
  }
  return out
}

/* ----------------------------------- Scene ---------------------------------- */

export class ParticleField {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private group = new THREE.Group()
  private points: THREE.Points
  private dust: THREE.Points
  private material: THREE.ShaderMaterial
  private geometry: THREE.BufferGeometry
  private clock = new THREE.Clock()
  private mouse = new THREE.Vector2(0, 0)
  private mouseTarget = new THREE.Vector2(0, 0)
  private raf = 0
  private running = true
  private count: number
  private morphTween: gsap.core.Tween | null = null
  private current = 0

  constructor(canvas: HTMLCanvasElement) {
    const mobile = window.innerWidth < 768
    this.count = mobile ? 9000 : 18000

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    this.renderer.setClearColor(0x000000, 0)

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.set(0, 0, 8)

    const n = this.count
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(sphere(n), 3))
    geo.setAttribute('aS1', new THREE.BufferAttribute(torusKnot(n), 3))
    geo.setAttribute('aS2', new THREE.BufferAttribute(terrain(n), 3))
    geo.setAttribute('aS3', new THREE.BufferAttribute(galaxy(n), 3))
    geo.setAttribute('aS4', new THREE.BufferAttribute(helix(n), 3))
    geo.setAttribute('aS5', new THREE.BufferAttribute(neural(n), 3))
    geo.setAttribute('aS6', new THREE.BufferAttribute(textShape(n), 3))
    const rnd = new Float32Array(n * 3)
    for (let i = 0; i < n * 3; i++) rnd[i] = Math.random()
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
    this.geometry = geo

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uSize: { value: mobile ? 46 : 44 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uAudio: { value: 0 },
        uOpacity: { value: 1 },
        uTurb: { value: 0 },
        uMouse: { value: this.mouse },
        uMouseStrength: { value: 0 },
        uAspect: { value: window.innerWidth / window.innerHeight },
        uPalA: { value: PALETTES.map((p) => new THREE.Color(p[0])) },
        uPalB: { value: PALETTES.map((p) => new THREE.Color(p[1])) },
      },
    })

    this.points = new THREE.Points(geo, this.material)
    this.group.add(this.points)
    this.scene.add(this.group)

    // Distant dust for depth
    const dn = mobile ? 600 : 1400
    const dpos = new Float32Array(dn * 3)
    for (let i = 0; i < dn; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(rand(9, 26))
      dpos.set([v.x, v.y, v.z], i * 3)
    }
    const dgeo = new THREE.BufferGeometry()
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3))
    this.dust = new THREE.Points(
      dgeo,
      new THREE.PointsMaterial({ size: 0.05, color: 0x8a90a8, transparent: true, opacity: 0.55, depthWrite: false }),
    )
    this.scene.add(this.dust)

    this.fit()

    // Re-sample the GUL text once the display font is loaded.
    document.fonts?.ready.then(() => {
      const attr = this.geometry.getAttribute('aS6') as THREE.BufferAttribute
      attr.copyArray(textShape(n))
      attr.needsUpdate = true
    })

    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointermove', this.onPointer, { passive: true })
    document.addEventListener('visibilitychange', this.onVisibility)
    this.loop()
  }

  private fit() {
    const aspect = window.innerWidth / window.innerHeight
    const s = THREE.MathUtils.clamp(aspect / 1.5, 0.52, 1)
    this.group.scale.setScalar(s)
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.material.uniforms.uAspect.value = w / h
    this.fit()
  }

  private onPointer = (e: PointerEvent) => {
    this.mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    gsap.to(this.material.uniforms.uMouseStrength, { value: 1, duration: 0.4, overwrite: true })
  }

  private onVisibility = () => {
    this.running = !document.hidden
    if (this.running) {
      this.clock.getDelta()
      this.loop()
    } else cancelAnimationFrame(this.raf)
  }

  setShape(i: number) {
    if (i === this.current) return
    this.current = i
    this.morphTween?.kill()
    const dist = Math.abs(this.material.uniforms.uMorph.value - i)
    this.morphTween = gsap.to(this.material.uniforms.uMorph, {
      value: i,
      duration: 1.4 + Math.min(dist, 3) * 0.35,
      ease: 'power2.inOut',
    })
    // The final "GUL" sits behind contact copy, so keep it softer.
    gsap.to(this.material.uniforms.uOpacity, { value: i === 6 ? 0.42 : 1, duration: 1.2, overwrite: true })
  }

  /** Sustained turbulence while something is charging (0..1). */
  charge(p: number) {
    this.chargeLevel = p
  }
  private chargeLevel = 0

  /** Big shockwave used on intro / special interactions. */
  pulse(amount = 1) {
    gsap.fromTo(this.material.uniforms.uTurb, { value: amount * 2.2 }, { value: 0, duration: 2.2, ease: 'expo.out' })
  }

  private loop = () => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const u = this.material.uniforms
    u.uTime.value += dt

    this.mouse.lerp(this.mouseTarget, 0.08)
    u.uMouseStrength.value *= 0.985

    const vel = Math.min(Math.abs(scrollState.velocity) / 30, 1)
    u.uTurb.value += (Math.max(vel * 0.9, this.chargeLevel * 1.3) - u.uTurb.value) * (this.chargeLevel > 0 ? 0.12 : 0.05)
    const level = audio.level()
    u.uAudio.value += (level * 0.9 - u.uAudio.value) * 0.15

    // Slow orbital rotation; scroll adds spin.
    this.group.rotation.y += dt * (0.06 + vel * 0.6)
    const tilt = this.current === 2 ? 0.32 : this.current === 3 ? 0.55 : this.current === 6 ? 0 : 0.15
    const ry = this.current === 6 ? Math.round(this.group.rotation.y / (Math.PI * 2)) * Math.PI * 2 : this.group.rotation.y
    if (this.current === 6) this.group.rotation.y += (ry - this.group.rotation.y) * 0.06
    this.group.rotation.x += (tilt + this.mouse.y * 0.12 - this.group.rotation.x) * 0.04
    this.group.rotation.z += (-this.mouse.x * 0.06 - this.group.rotation.z) * 0.04

    this.camera.position.x += (this.mouse.x * 0.35 - this.camera.position.x) * 0.04
    this.camera.position.y += (this.mouse.y * 0.25 - this.camera.position.y) * 0.04
    this.camera.lookAt(0, 0, 0)

    this.dust.rotation.y += dt * 0.01
    this.dust.rotation.x = scrollState.progress * 0.6

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pointermove', this.onPointer)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }
}
