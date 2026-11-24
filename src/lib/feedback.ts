import { audio } from './audio'
import { haptics } from './haptics'

/** Unified multisensory feedback: sound + haptics in one call. */
export const fx = {
  hover: () => audio.hover(),
  click: () => {
    audio.click()
    haptics.fire('click')
  },
  tap: () => haptics.fire('tap'),
  success: () => {
    audio.success()
    haptics.fire('success')
  },
  section: () => {
    audio.whoosh(0.6)
    haptics.fire('tick')
  },
  note: (i: number) => {
    audio.note(i)
    haptics.fire('tick')
  },
}

/** Spread onto any interactive element: <a {...hoverFx}> */
export const hoverFx = {
  onMouseEnter: () => fx.hover(),
  onClick: () => fx.click(),
}
