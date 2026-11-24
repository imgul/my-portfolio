/**
 * Haptics: uses the Vibration API (Android / Chromium) and falls back to the
 * iOS 18+ Safari "switch" checkbox trick, which emits a system haptic tick
 * when its label is clicked during a user gesture.
 */
type Pattern = 'tap' | 'click' | 'success' | 'heavy' | 'tick'

const patterns: Record<Pattern, number | number[]> = {
  tick: 4,
  tap: 8,
  click: 14,
  heavy: [24, 30, 24],
  success: [10, 50, 18, 50, 30],
}

let enabled = true
let iosLabel: HTMLLabelElement | null = null

const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator
const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

function ensureIOS() {
  if (iosLabel || typeof document === 'undefined') return
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  iosLabel = label
}

export const haptics = {
  supported: () =>
    (canVibrate() || isIOS()) && typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  setEnabled(v: boolean) {
    enabled = v
  },
  get enabled() {
    return enabled
  },
  /** Raw vibration (ms or pattern). On iOS each call is a single system tick. */
  buzz(pattern: number | number[]) {
    if (!enabled) return
    try {
      if (canVibrate()) navigator.vibrate(pattern)
      else if (isIOS() && pattern !== 0) {
        ensureIOS()
        iosLabel?.click()
      }
    } catch {
      /* noop */
    }
  },
  fire(p: Pattern = 'tap') {
    if (!enabled) return
    try {
      if (canVibrate()) {
        navigator.vibrate(patterns[p])
      } else if (isIOS()) {
        ensureIOS()
        iosLabel?.click()
        if (p === 'success' || p === 'heavy') setTimeout(() => iosLabel?.click(), 90)
      }
    } catch {
      /* noop */
    }
  },
}
