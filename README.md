# gulzaib.dev: portfolio of Muhammad Gulzaib

A portfolio you can see, hear and feel, built for Muhammad Gulzaib (Gul): Founder & CEO of SynergyFlow Labs and Senior Full Stack Engineer.

## What's inside

| Layer | Tech |
| --- | --- |
| 3D | **Three.js**. A single GPU particle system (up to 20k points) with its own animated shape for every section: galaxy (Intro) → DNA (Manifesto) → winding road with milestones (Journey) → city of boxes (Ventures) → open book with a turning page (Notes) → floating stack layers (Stack) → neural network (Agents) → tree with roots (Learning) → Margalla Hills with a trail and sun (Beyond) → globe with arcs from Islamabad (Contact). Custom GLSL morphs the shapes in a staggered wave and adds per-shape motion, gentle mouse repulsion and scroll turbulence. Each shape sits beside its section's text, and a "reading mode" slows and dims the scene while you read, then wakes it when you scroll. |
| Motion | **GSAP + ScrollTrigger** (pinned manifesto, horizontal journey, stacking venture cards, counters, split-letter reveals) and **Lenis** smooth scroll |
| Sound | **Web Audio API**, fully generative with no audio files. The default **Soundtrack** gives every section its own piece of music matched to its 3D shape (Interstellar-style organ for the galaxy, Bach for Learning, birdsong and a wooden flute for the Margalla Hills…) and crossfades between them as you scroll. Everything stays calm, with no drums or noise beds. Soft UI sounds. |
| Haptics | **Vibration API** on Android, plus the iOS 18+ Safari switch-checkbox haptic trick |
| Interaction | Magnetic buttons, custom cursor, 3D tilt cards, a playable "stack synth", a clickable multi-agent orchestrator with a live terminal, velocity-reactive marquees |
| App | React 19 + TypeScript + Vite |

Press **M** to toggle sound and **N** to switch the music track. The site respects `prefers-reduced-motion`.

### A soundtrack per section

The default track, **Soundtrack** (`src/lib/sound/themes/soundtrack.ts`, instruments in `src/lib/sound/instruments.ts`), gives every section its own piece. Scrolling into a section crossfades to its piece over about 3 seconds, and the "now playing" chip shows the title.

| Section | Shape | Piece | Instruments |
|---|---|---|---|
| Intro | galaxy | **Interstellar** | pipe organ chords, a slow pedal-note ostinato, a soft ticking clock (A minor) |
| Manifesto | DNA | **Conviction** | bowed strings over a pizzicato heartbeat, a violin line swelling in (D minor) |
| Journey | road | **Open Road** | fingerpicked acoustic guitar, Travis-style (G major) |
| Ventures | city | **City Lights** | minimalist marimba cell that shifts against the beat (F lydian) |
| Notes | book | **Pages** | solo felt piano, rolled chords and a rubato melody |
| Stack | layers | **Clockwork** | two kalimbas meshing like gears, 4 against 3 (E minor) |
| Agents | neural net | **Many Minds** | three "agents" (bell, kalimba, piano) looping phrases of different lengths (D dorian) |
| Learning | tree | **Study Hall** | Bach's Prelude in C on piano with a cello pedal, classic study music |
| Beyond | mountains | **Margalla Trail** | nature: birdsong, a breeze, a mountain stream, wooden-flute phrases, a soft drone |
| Contact | globe | **Homecoming** | warm piano arpeggios and strings (D major) |

The keyboard sounds (the playable stack synth, the hold-to-copy charge) follow the key of whatever piece is playing. A rendered tour of all ten pieces is in `sound-previews/tour-soundtrack.mp3`.

**Other tracks.** Press **N** or tap the chip to switch between Soundtrack, Deep Focus (one calm pad and piano piece), Original, A · Neon Pulse, B · Margalla Dawn and C · Night Shift (lo-fi). Those share one score that re-arranges itself per section (`scenes.ts` and `conductor.ts`): layers, key, tone, reverb and ambience change with each section. Audition any track with `/?sound=soundtrack|focus|original|pulse|dawn|lofi`.

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
  three/ParticleField.ts  morphing particle scene (GLSL, per-shape motion + framing)
  three/shapes.ts         point-cloud builders, one per section
  lib/audio.ts            generative music + SFX engine
  lib/haptics.ts          vibration / iOS haptics
  lib/scroll.ts           Lenis + ScrollTrigger wiring
  components/             one file per section + HUD, cursor, loader
```

## Deploy

It's a static Vite app. On Vercel, import the repo and it auto-detects Vite (build `npm run build`, output `dist`).
