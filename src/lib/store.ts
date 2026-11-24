import { useSyncExternalStore } from 'react'

type State = {
  entered: boolean
  sound: boolean
  haptics: boolean
  section: number
  toast: string | null
}

let state: State = { entered: false, sound: false, haptics: true, section: 0, toast: null }
const listeners = new Set<() => void>()

export const store = {
  get: () => state,
  set(patch: Partial<State>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state), () => sel(state))
}

let toastTimer: number | undefined
export function toast(msg: string) {
  store.set({ toast: msg })
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => store.set({ toast: null }), 2200)
}
