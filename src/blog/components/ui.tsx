/** Small shared UI bits for the blog: toast, copy-to-clipboard, icons. */
import { useEffect, useState } from 'react'

const listeners = new Set<(msg: string) => void>()
export const toast = (msg: string) => listeners.forEach((l) => l(msg))

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t = 0
    const on = (m: string) => {
      setMsg(m)
      clearTimeout(t)
      t = window.setTimeout(() => setMsg(null), 2200)
    }
    listeners.add(on)
    return () => {
      listeners.delete(on)
    }
  }, [])
  return (
    <div className={`b-toast ${msg ? 'is-on' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
}

export async function copy(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  navigator.vibrate?.(12)
  toast(label)
}

type IconName = 'copy' | 'check' | 'link' | 'rss' | 'search' | 'type' | 'x' | 'linkedin' | 'mail' | 'arrow' | 'up' | 'music' | 'github' | 'menu' | 'close' | 'quote'
const PATHS: Record<IconName, string> = {
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12l5 5L20 7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  rss: 'M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8M6 18h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  type: 'M4 7V5h16v2M9 19h6M12 5v14',
  x: 'M4 4l16 16M20 4L4 20',
  linkedin: 'M6 9v10M6 5v.01M10 19v-6a3 3 0 0 1 6 0v6M10 10v9',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  github: 'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.6 2.5 5.6 2.8 5.6 2.8a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4.2 9.2c0 4.6 2.8 5.6 5.5 6a3 3 0 0 0-.8 2.2V21',
  menu: 'M4 8h16M4 16h16',
  close: 'M6 6l12 12M18 6L6 18',
  quote: 'M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6',
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
