import { useStore } from '../lib/store'

export default function Toast() {
  const msg = useStore((s) => s.toast)
  return (
    <div className={`toast ${msg ? 'is-on' : ''}`} role="status" aria-live="polite">
      <span className="toast__dot" /> {msg}
    </div>
  )
}
