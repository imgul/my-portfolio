/** Small shared UI bits for the blog: toast, copy-to-clipboard, icons. */
import { useEffect, useState } from 'react'

interface ToastMsg {
  text: string
  action?: { label: string; run: () => void }
  ms?: number
}
const listeners = new Set<(m: ToastMsg | null) => void>()
export const toast = (text: string, opts: Omit<ToastMsg, 'text'> = {}) => listeners.forEach((l) => l({ text, ...opts }))
export const dismissToast = () => listeners.forEach((l) => l(null))

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  useEffect(() => {
    let t = 0
    const on = (m: ToastMsg | null) => {
      setMsg(m)
      clearTimeout(t)
      if (m) t = window.setTimeout(() => setMsg(null), m.ms ?? (m.action ? 9000 : 2400))
    }
    listeners.add(on)
    return () => {
      listeners.delete(on)
    }
  }, [])
  return (
    <div className={`b-toast ${msg ? 'is-on' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      {msg && (
        <>
          <span>{msg.text}</span>
          {msg.action && (
            <button
              className="b-toast__action"
              onClick={() => {
                msg.action!.run()
                setMsg(null)
              }}
            >
              {msg.action.label}
            </button>
          )}
          {msg.action && (
            <button className="b-toast__close" onClick={() => setMsg(null)} aria-label="Dismiss">
              <Icon name="close" size={14} />
            </button>
          )}
        </>
      )}
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

export type IconName =
  | 'copy'
  | 'check'
  | 'link'
  | 'rss'
  | 'search'
  | 'x'
  | 'linkedin'
  | 'mail'
  | 'arrow'
  | 'up'
  | 'github'
  | 'close'
  | 'quote'
  | 'like'
  | 'dislike'
  | 'bookmark'
  | 'headphones'
  | 'play'
  | 'pause'
  | 'stop'
  | 'share'
  | 'focus'
  | 'keyboard'
  | 'grid'
  | 'list'
  | 'markdown'
  | 'wrap'
  | 'zoom'
  | 'toc'
  | 'settings'
  | 'clock'
  | 'eye'
  | 'reset'
  | 'whatsapp'
  | 'pdf'
  | 'download'
  | 'id'

const PATHS: Record<IconName, string> = {
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12l5 5L20 7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  rss: 'M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8M6 18h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  x: 'M4 4l16 16M20 4L4 20',
  linkedin: 'M6 9v10M6 5v.01M10 19v-6a3 3 0 0 1 6 0v6M10 10v9',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  github:
    'M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.6 2.5 5.6 2.8 5.6 2.8a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4.2 9.2c0 4.6 2.8 5.6 5.5 6a3 3 0 0 0-.8 2.2V21',
  close: 'M6 6l12 12M18 6L6 18',
  quote: 'M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6',
  like: 'M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7',
  dislike: 'M17 13V4h3v9zM17 13l-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 4H17',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  stop: 'M6 6h12v12H6z',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
  focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  markdown: 'M3 6h18v12H3zM6 15V9l3 3 3-3v6M16 9v6M14 13l2 2 2-2',
  wrap: 'M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M15 16l-2 2 2 2M4 18h5',
  zoom: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M11 8v6M8 11h6',
  toc: 'M4 6h10M4 12h16M4 18h12',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  reset: 'M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10',
  whatsapp: 'M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z',
  pdf: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  id: 'M3 5h18v14H3zM7 10h.01M7 14h4M14 9h4M14 13h4M7 10a1.5 1.5 0 1 0 0 .01',
}

export function Icon({ name, size = 18, filled }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
