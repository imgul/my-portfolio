import { useEffect, useState, useSyncExternalStore } from 'react'
import { useStore, store, toast } from '../lib/store'
import { audio } from '../lib/audio'
import { haptics } from '../lib/haptics'
import { SCENES } from '../lib/sound/scenes'

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
  const [swap, setSwap] = useState(0)
  const scene = SCENES[section] ?? SCENES[0]

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
      title="Switch music (each section has its own mix)"
      aria-label={`Now playing: ${scene.mood}, ${themeName}. Switch track`}
    >
      <span className="np__disc" aria-hidden="true">
        <span />
      </span>
      <span className="np__text">
        <span className="np__roll">
          <span key={section} className="np__mood">
            {scene.mood}
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
