import { useEffect, useState, useSyncExternalStore } from 'react'
import { useStore, store, toast } from '../lib/store'
import { audio } from '../lib/audio'
import { haptics } from '../lib/haptics'
import { SCENES } from '../lib/sound/scenes'
import { getTheme } from '../lib/sound'

/**
 * "Now playing" chip (bottom-right). Shows the musical mood of the current
 * section and the active sound theme; tap it to switch to the next track.
 */
export default function NowPlaying({ visible }: { visible: boolean }) {
  const sound = useStore((s) => s.sound)
  const section = useStore((s) => s.section)
  const themeName = useSyncExternalStore(
    (fn) => audio.subscribe(fn),
    () => audio.themeName,
  )
  const themeId = useSyncExternalStore(
    (fn) => audio.subscribe(fn),
    () => audio.themeId,
  )
  const [swap, setSwap] = useState(0)
  const scene = SCENES[section] ?? SCENES[0]
  // the Soundtrack names a piece per section; other tracks show the section's mood
  const title = getTheme(themeId).tracks?.[section] ?? scene.mood

  useEffect(() => setSwap((n) => n + 1), [themeName])

  const next = () => {
    if (!sound) {
      store.set({ sound: true })
      audio.setMuted(false)
    } else audio.nextTheme()
    haptics.fire('click')
    toast(`Now playing · ${audio.themeName}`)
  }

  return (
    <button
      className={`np mono ${visible ? 'is-on' : ''} ${sound ? 'is-playing' : 'is-muted'}`}
      onClick={next}
      onMouseEnter={() => audio.hover()}
      data-cursor="Next track"
      title="Switch music (each section has its own piece)"
      aria-label={`Now playing: ${title}, ${themeName}. Switch track`}
    >
      <span className="np__disc" aria-hidden="true">
        <span />
      </span>
      <span className="np__text">
        <span className="np__roll">
          <span key={section} className="np__mood">
            {title}
          </span>
        </span>
        <span className="np__roll np__roll--sub">
          <span key={swap} className="np__theme">
            {themeName} <em>⇄</em>
          </span>
        </span>
      </span>
    </button>
  )
}
