import * as THREE from 'three'
import { gsap } from 'gsap'
import { audio } from '../lib/audio'
import { scrollState } from '../lib/scroll'
import { BUILDERS, gauss } from './shapes'

/**
 * A single GPU particle system that morphs between one shape per section:
 * 0 galaxy · 1 DNA · 2 winding road · 3 city of boxes · 4 open book · 5 layer stack
 * 6 neural network · 7 tree with roots · 8 Margalla Hills · 9 globe with arcs.
 * Shapes are built in ./shapes.ts. Morphing is a weighted crossfade (so jumping from
 * Intro to Contact goes straight there), and every shape has its own motion in the
 * vertex shader: orbiting stars, a spinning helix, flowing lane dashes, flickering
 * windows and traffic, a turning page, rising data packets, signals firing through
 * the network, swaying and falling leaves, a sparkle climbing the trail, pulses
 * flying along the globe arcs. Mouse repulsion, scroll turbulence and audio
 * reactivity are layered on top.
 */

export const SHAPES = BUILDERS.length

type ShapeConfig = {
  /** colours: a (low / random) → b (high) */
  pal: [string, string]
  /** 0 = random colour mix, 1 = colour by height */
  hc: number
  /** x-tilt of the whole group (positive = look down onto it) */
  tilt: number
  /** continuous y-spin speed; ignored when `face` is set */
  spin: number
  /** face the camera at this yaw (with a gentle sway) instead of spinning */
  face?: { yaw: number; sway: number }
  opacity: number
  scale: number
  /** where the shape sits (world units, desktop) so it stays clear of the section's text */
  pos: [number, number]
}

const CONFIG: ShapeConfig[] = [
  { pal: ['#ff9d5c', '#8a6bff'], hc: 0, tilt: 0.55, spin: 0.03, opacity: 1, scale: 1, pos: [0.6, 0.1] }, // galaxy
  { pal: ['#3dd6ff', '#c6ff3d'], hc: 0, tilt: 0, spin: 0, face: { yaw: 0, sway: 0 }, opacity: 0.42, scale: 0.85, pos: [3.7, 0] }, // DNA
  { pal: ['#5b8cff', '#c6ff3d'], hc: 0.35, tilt: 0.42, spin: 0, face: { yaw: 0.5, sway: 0.22 }, opacity: 0.8, scale: 1, pos: [0.4, -0.3] }, // road
  { pal: ['#5b8cff', '#c46bff'], hc: 0.6, tilt: 0.38, spin: 0.07, opacity: 0.85, scale: 0.95, pos: [2.2, 0.2] }, // city
  { pal: ['#f2efe4', '#c6ff3d'], hc: 0, tilt: 0.8, spin: 0, face: { yaw: -0.25, sway: 0.1 }, opacity: 0.55, scale: 0.9, pos: [2.4, 0.3] }, // book
  { pal: ['#3dffb5', '#5b8cff'], hc: 0.8, tilt: 0.42, spin: 0.06, opacity: 0.6, scale: 0.85, pos: [2.8, 0.4] }, // stack
  { pal: ['#c46bff', '#3dd6ff'], hc: 0, tilt: 0.08, spin: 0, face: { yaw: 0.45, sway: 0.2 }, opacity: 0.8, scale: 0.85, pos: [2.1, 0.7] }, // neural
  { pal: ['#ff9d5c', '#c6ff3d'], hc: 1, tilt: 0.08, spin: 0.08, opacity: 0.7, scale: 0.9, pos: [2.9, 0.2] }, // tree
  { pal: ['#7a8cff', '#ffb36b'], hc: 0.9, tilt: 0.16, spin: 0, face: { yaw: 0, sway: 0.18 }, opacity: 0.95, scale: 1, pos: [0.6, -0.25] }, // mountains
  { pal: ['#c6ff3d', '#5b8cff'], hc: 0, tilt: 0.42, spin: 0, face: { yaw: 0, sway: 0.45 }, opacity: 0.5, scale: 0.9, pos: [2.9, -0.4] }, // globe (behind contact copy)
]

const attrs = Array.from({ length: SHAPES }, (_, i) => `attribute vec4 aS${i};`).join('\n')
const blend = Array.from(
  { length: SHAPES },
  (_, i) =>
    `  { float wf = uWFrom[${i}]; float wt = step(abs(uTo - ${i}.0), 0.5);
    if (wf + wt > 0.001) { float g = 0.0; vec3 q = shape${i}(aS${i}, g); pFrom += wf * q; pTo += wt * q; gFrom += wf * g; gTo += wt * g; } }`,
).join('\n')

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uWFrom[${SHAPES}];
  uniform float uTo;
  uniform float uE;
  uniform float uTransAmt;
  uniform float uHC;
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uAudio;
  uniform float uTurb;
  uniform vec2 uMouse;
  uniform float uMouseStrength;
  ${attrs}
  attribute vec3 aRnd;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  bool tag(float w, float v) { return abs(w - v) < 0.5; }

  // 0 galaxy: differential rotation (inner stars orbit faster)
  vec3 shape0(vec4 s, inout float g) {
    g += 0.5 * smoothstep(0.7, 0.0, s.w);
    return rotY(s.xyz, uTime * 0.28 / (0.45 + s.w * 0.5));
  }
  // 1 DNA: spins on its own axis, tilted; a light wave runs up the base pairs
  vec3 shape1(vec4 s, inout float g) {
    vec3 p = rotY(s.xyz, uTime * 0.45);
    float c = cos(0.5), sn = sin(0.5);
    p = vec3(c * p.x - sn * p.y, sn * p.x + c * p.y, p.z);
    if (s.w > 0.5) g += 0.25 + 0.55 * pow(0.5 + 0.5 * sin(uTime * 2.4 - s.y * 1.3), 4.0);
    return p;
  }
  // 2 road: lane dashes flow toward you, milestone pins pulse
  float roadX(float z) { return sin(z * 0.45) * 1.6; }
  vec3 shape2(vec4 s, inout float g) {
    vec3 p = s.xyz;
    if (tag(s.w, 1.0)) {
      float z = p.z + fract(uTime * 0.7) * (1.0 / 1.2);
      p.x = roadX(z) + (p.x - roadX(p.z));
      p.z = z;
      g += 0.45;
    } else if (tag(s.w, 2.0)) {
      g += 0.5 + 0.5 * sin(uTime * 2.0 + s.z * 1.7);
    }
    return p;
  }
  // 3 city: windows flicker on and off, traffic streams along the streets
  vec3 shape3(vec4 s, inout float g) {
    vec3 p = s.xyz;
    if (tag(s.w, 1.0)) {
      float h = hash(floor(s.xyz * 20.0));
      g += step(0.35, sin(uTime * (0.3 + h * 0.6) + h * 40.0)) * (0.5 + h * 0.5);
    } else if (tag(s.w, 2.0)) {
      p.x = mod(p.x + uTime * 0.7 + 3.0, 6.0) - 3.0;
      g += 0.7;
    } else if (tag(s.w, 3.0)) {
      p.z = mod(p.z + uTime * 0.6 + 3.0, 6.0) - 3.0;
      g += 0.7;
    }
    return p;
  }
  // 4 book: one page keeps turning from right to left
  float pageY(float u) { return 0.35 * (1.0 - exp(-u * 5.0)); }
  vec3 shape4(vec4 s, inout float g) {
    if (s.w < 0.5) return s.xyz;
    float u = s.x;
    float r = u * 2.4;
    float ph = fract(uTime / 6.0);
    float th = smoothstep(0.2, 0.8, ph) * 3.14159;
    float curl = th + sin(th) * 0.55 * u;
    float flatK = abs(cos(curl));
    g += 0.25 * sin(th);
    return vec3(cos(curl) * r, -0.2 + 0.02 + sin(curl) * r + pageY(u) * flatK, s.z);
  }
  // 5 stack: the layers breathe apart, data packets rise between them
  vec3 shape5(vec4 s, inout float g) {
    vec3 p = s.xyz;
    if (s.w > 0.5) {
      p.y = mod(p.y + uTime * 0.9 + 2.6, 5.2) - 2.6;
      g += 0.9;
    } else p.y *= 1.0 + 0.08 * sin(uTime * 0.8);
    return p;
  }
  // 6 neural network: waves of signals fire from input to output
  vec3 shape6(vec4 s, inout float g) {
    float head = mod(uTime * 1.5, 6.5) - 0.8;
    g += 1.3 * exp(-pow((s.w - head) * 2.6, 2.0));
    return s.xyz;
  }
  // 7 tree: leaves sway in the breeze, a few drift down
  vec3 shape7(vec4 s, inout float g) {
    vec3 p = s.xyz;
    float k = max(p.y + 1.3, 0.0) * 0.05;
    if (tag(s.w, 1.0)) {
      p.x += sin(uTime * 1.2 + p.y * 0.8 + p.z) * k * 1.6;
      p.z += cos(uTime * 1.0 + p.x) * k;
    } else if (tag(s.w, 2.0)) {
      float y = -1.3 + mod(p.y + 1.3 - uTime * 0.28, 3.7);
      p.x += sin(uTime * 1.3 + s.y * 7.0) * 0.25;
      p.y = y;
      g += 0.3;
    } else {
      p.x += sin(uTime * 1.2 + p.y * 0.8) * k * 0.5;
    }
    return p;
  }
  // 8 mountains: a sparkle climbs the trail, the sun glows
  vec3 shape8(vec4 s, inout float g) {
    if (s.w >= 1.0 && s.w < 2.0) {
      float head = fract(uTime * 0.1);
      g += 0.05 + 1.3 * exp(-pow((s.w - 1.0 - head) * 22.0, 2.0));
    } else if (tag(s.w, 3.0)) g += 0.35 + 0.2 * sin(uTime * 0.8);
    return s.xyz;
  }
  // 9 globe: pulses fly out of Islamabad along every arc, cities blink
  vec3 shape9(vec4 s, inout float g) {
    if (s.w >= 1.0 && s.w < 2.0) {
      float t = s.w - 1.0;
      float head = fract(uTime * 0.28);
      g += 0.15 + 1.5 * exp(-pow((t - head) * 10.0, 2.0));
    } else if (tag(s.w, 3.0)) g += 0.6 + 0.4 * sin(uTime * 3.0 + s.x * 5.0);
    return s.xyz;
  }

  void main() {
    vec3 pFrom = vec3(0.0), pTo = vec3(0.0);
    float gFrom = 0.0, gTo = 0.0;
${blend}
    // Staggered morph: each particle leaves a little later than the last, so shapes
    // dissolve and re-form as a flowing wave rather than all at once.
    float el = smoothstep(0.0, 1.0, clamp(uE * 1.7 - aRnd.x * 0.7, 0.0, 1.0));
    vec3 p = mix(pFrom, pTo, el);
    float glow = mix(gFrom, gTo, el);
    float trans = sin(el * 3.14159) * uTransAmt;

    // Transition turbulence: particles scatter mid-morph and re-form.
    float t = uTime * 0.6 + aRnd.x * 6.2831;
    vec3 swirl = vec3(
      sin(p.y * 1.7 + t) + cos(p.z * 0.9 + t * 0.7),
      sin(p.z * 1.3 + t * 1.1) + cos(p.x * 1.1 - t * 0.6),
      sin(p.x * 1.5 + t * 0.9) + cos(p.y * 1.2 + t * 0.8)
    );
    float idle = 0.012 + uTurb * 0.12 + uAudio * 0.03;
    p += swirl * (idle + trans * 0.55 * (0.4 + aRnd.y));

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
    float size = uSize * (0.35 + aRnd.z) * (1.0 + uAudio * 0.25 + force * 1.2 + glow * 0.55);
    gl_PointSize = size * uPixelRatio / depth;

    float rndMix = clamp(aRnd.y * 0.7 + (p.y + 2.0) * 0.12, 0.0, 1.0);
    float hMix = clamp((p.y + 2.4) / 5.0 + (aRnd.y - 0.5) * 0.25, 0.0, 1.0);
    vColor = mix(uColA, uColB, mix(rndMix, hMix, uHC)) * (1.0 + glow * 0.9) + force * 0.6 + glow * 0.12;
    float twinkle = 0.88 + 0.12 * sin(uTime * (0.8 + aRnd.y * 1.6) + aRnd.x * 40.0);
    vAlpha = (0.35 + aRnd.z * 0.65) * smoothstep(22.0, 4.0, depth) * smoothstep(2.4, 4.6, depth) * (1.0 + glow * 0.5) * twinkle;
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
    float glow = smoothstep(0.5, 0.05, r);
    float core = smoothstep(0.2, 0.0, r);
    float a = (glow * 0.5 + core) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor * (glow * 0.6 + core) * uOpacity, a);
  }
`

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
  /** Crossfade weight of every shape (sums to 1). */
  private weights = new Float32Array(SHAPES)
  private palA = CONFIG.map((c) => new THREE.Color(c.pal[0]))
  private palB = CONFIG.map((c) => new THREE.Color(c.pal[1]))
  private fitScale = 1
  private shapeScale = CONFIG[0].scale
  private time = 0
  private activity = 1

  constructor(canvas: HTMLCanvasElement) {
    const mobile = window.innerWidth < 768
    this.count = mobile ? 10000 : 20000

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    this.renderer.setClearColor(0x000000, 0)

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    this.camera.position.set(0, 0, 8)

    const n = this.count
    const geo = new THREE.BufferGeometry()
    BUILDERS.forEach((build, i) => {
      const data = build(n)
      geo.setAttribute(`aS${i}`, new THREE.BufferAttribute(data, 4))
      if (i === 0) {
        const pos = new Float32Array(n * 3)
        for (let k = 0; k < n; k++) pos.set([data[k * 4], data[k * 4 + 1], data[k * 4 + 2]], k * 3)
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      }
    })
    const rnd = new Float32Array(n * 3)
    for (let i = 0; i < n * 3; i++) rnd[i] = Math.random()
    geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 3))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20)
    this.geometry = geo
    this.weights[0] = 1

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uWFrom: { value: Array.from(this.weights) },
        uTo: { value: 0 },
        uE: { value: 1 },
        uTransAmt: { value: 0 },
        uHC: { value: CONFIG[0].hc },
        uColA: { value: this.palA[0].clone() },
        uColB: { value: this.palB[0].clone() },
        uSize: { value: mobile ? 40 : 38 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uAudio: { value: 0 },
        uOpacity: { value: 1 },
        uTurb: { value: 0 },
        uMouse: { value: this.mouse },
        uMouseStrength: { value: 0 },
        uAspect: { value: window.innerWidth / window.innerHeight },
      },
    })

    this.points = new THREE.Points(geo, this.material)
    this.group.add(this.points)
    this.scene.add(this.group)

    // Distant dust for depth
    const dn = mobile ? 600 : 1400
    const dpos = new Float32Array(dn * 3)
    for (let i = 0; i < dn; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(9 + Math.random() * 17)
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
    this.group.rotation.x = CONFIG[0].tilt

    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointermove', this.onPointer, { passive: true })
    document.addEventListener('visibilitychange', this.onVisibility)
    this.loop()
  }

  private fit() {
    const aspect = window.innerWidth / window.innerHeight
    this.fitScale = THREE.MathUtils.clamp(aspect / 1.5, 0.52, 1)
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

  /** Morph to the shape of section `i` (crossfades from wherever we are, even mid-morph). */
  setShape(i: number) {
    i = Math.max(0, Math.min(SHAPES - 1, Math.round(i)))
    if (i === this.current) return
    const u = this.material.uniforms
    // snapshot where we are now (approximate if we were still mid-morph)
    const e0 = u.uE.value as number
    const prevTo = u.uTo.value as number
    const from = u.uWFrom.value as number[]
    for (let k = 0; k < SHAPES; k++) from[k] = from[k] * (1 - e0) + (k === prevTo ? e0 : 0)
    u.uTo.value = i
    u.uE.value = 0
    u.uTransAmt.value = 1 - from[i]
    this.current = i
    this.morphTween?.kill()
    const start = Float32Array.from(from)
    this.morphTween = gsap.to(u.uE, {
      value: 1,
      duration: 2.2,
      ease: 'power1.inOut',
      onUpdate: () => {
        const e = u.uE.value as number
        for (let k = 0; k < SHAPES; k++) this.weights[k] = start[k] * (1 - e) + (k === i ? e : 0)
        this.applyWeights()
      },
    })
  }

  private applyWeights() {
    const u = this.material.uniforms
    const a = u.uColA.value as THREE.Color
    const b = u.uColB.value as THREE.Color
    a.setRGB(0, 0, 0)
    b.setRGB(0, 0, 0)
    let hc = 0
    for (let k = 0; k < SHAPES; k++) {
      const w = this.weights[k]
      if (w <= 0) continue
      a.r += this.palA[k].r * w
      a.g += this.palA[k].g * w
      a.b += this.palA[k].b * w
      b.r += this.palB[k].r * w
      b.g += this.palB[k].g * w
      b.b += this.palB[k].b * w
      hc += CONFIG[k].hc * w
    }
    u.uHC.value = hc
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
    this.time += dt
    const u = this.material.uniforms

    // Reading mode: while the visitor isn't scrolling, the scene calms down
    // (slower motion, dimmer) so the text gets the attention. Scrolling wakes it up.
    const vel = Math.min(Math.abs(scrollState.velocity) / 30, 1)
    const morphing = (u.uE.value as number) < 1
    const awake = Math.min(1, Math.max(vel * 2.5, this.chargeLevel, morphing ? 1 : 0))
    this.activity += (awake - this.activity) * (awake > this.activity ? 0.08 : 0.012)
    u.uTime.value += dt * (0.45 + 0.55 * this.activity)

    this.mouse.lerp(this.mouseTarget, 0.08)
    u.uMouseStrength.value *= 0.985

    u.uTurb.value += (Math.max(vel * 0.9, this.chargeLevel * 1.3) - u.uTurb.value) * (this.chargeLevel > 0 ? 0.12 : 0.05)
    const level = audio.level()
    u.uAudio.value += (level * 0.9 - u.uAudio.value) * 0.15

    // Framing per shape: some spin slowly, others turn to face you and sway.
    const cfg = CONFIG[this.current]
    const g = this.group
    g.rotation.y += dt * vel * 0.6
    if (cfg.face) {
      const TAU = Math.PI * 2
      const target = Math.round((g.rotation.y - cfg.face.yaw) / TAU) * TAU + cfg.face.yaw + Math.sin(this.time * 0.2) * cfg.face.sway
      g.rotation.y += (target - g.rotation.y) * 0.03
    } else g.rotation.y += dt * cfg.spin
    g.rotation.x += (cfg.tilt + this.mouse.y * 0.12 - g.rotation.x) * 0.035
    g.rotation.z += (-this.mouse.x * 0.06 - g.rotation.z) * 0.04
    this.shapeScale += (cfg.scale - this.shapeScale) * 0.04
    g.scale.setScalar(this.fitScale * this.shapeScale)
    // Keep the shape beside the text: full offset on wide screens, near-centre on phones.
    const narrow = window.innerWidth < 768
    const k = narrow ? 0.15 : THREE.MathUtils.clamp((window.innerWidth / window.innerHeight - 0.9) * 1.3, 0.3, 1)
    g.position.x += (cfg.pos[0] * k - g.position.x) * 0.03
    g.position.y += (cfg.pos[1] * (narrow ? 0.4 : 1) - g.position.y) * 0.03
    const targetOpacity = cfg.opacity * (narrow ? 0.55 : 1) * (0.8 + 0.2 * this.activity)
    u.uOpacity.value += (targetOpacity - u.uOpacity.value) * 0.04

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
