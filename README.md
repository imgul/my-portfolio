# gulzaib.dev: portfolio of Muhammad Gulzaib

A portfolio you can see, hear and feel, built for Muhammad Gulzaib (Gul): Founder & CEO of SynergyFlow Labs and Senior Full Stack Engineer.

## What's inside

| Layer | Tech |
| --- | --- |
| 3D | **Three.js**. A single GPU particle system (up to 18k points) that morphs between 7 shapes as you scroll: core sphere → torus knot → Margalla-style terrain → galaxy → DNA helix → neural constellation → the word "GUL". Custom GLSL adds noise, mouse repulsion, scroll turbulence and audio reactivity. |
| Motion | **GSAP + ScrollTrigger** (pinned manifesto, horizontal journey, stacking venture cards, counters, split-letter reveals) and **Lenis** smooth scroll |
| Sound | **Web Audio API**, fully generative with no audio files: evolving ambient pad, pentatonic "music box", hover/click/whoosh SFX. Scroll speed opens the filter. |
| Haptics | **Vibration API** on Android, plus the iOS 18+ Safari switch-checkbox haptic trick |
| Interaction | Magnetic buttons, custom cursor, 3D tilt cards, a playable "stack synth", a clickable multi-agent orchestrator with a live terminal, velocity-reactive marquees |
| App | React 19 + TypeScript + Vite |

Press **M** to toggle sound. The site respects `prefers-reduced-motion`.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview
```

## Edit content

All copy (experience, ventures, skills, certifications, agents and so on) lives in
[`src/data/content.ts`](src/data/content.ts). Edit that file and you don't need to touch any component.

## Structure

```
src/
  data/content.ts         all portfolio content
  three/ParticleField.ts  morphing particle scene (GLSL)
  lib/audio.ts            generative music + SFX engine
  lib/haptics.ts          vibration / iOS haptics
  lib/scroll.ts           Lenis + ScrollTrigger wiring
  components/             one file per section + HUD, cursor, loader
```

## Deploy

It's a static Vite app. On Vercel, import the repo and it auto-detects Vite (build `npm run build`, output `dist`).
