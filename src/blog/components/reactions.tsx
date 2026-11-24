/**
 * "Was this useful?" like / dislike, stored anonymously in Supabase.
 * Optimistic, keyboard and screen-reader friendly (aria-pressed toggle
 * buttons + a polite live region), with an optional note after voting.
 */
import { useId, useState, type FormEvent } from 'react'
import { react, reactionsEnabled, sendReason, useCounts } from '../reactions'
import { useReader } from '../store'
import { useHydrated } from '../hydrated'
import { Icon } from './ui'

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n))

export function Reactions({ slug, title }: { slug: string; title: string }) {
  const hydrated = useHydrated()
  const { votes } = useReader()
  const counts = useCounts([slug])(slug)
  const vote = (hydrated ? votes[slug] : 0) ?? 0
  const [announce, setAnnounce] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [noteState, setNoteState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [askedFor, setAskedFor] = useState<0 | 1 | -1>(0)
  const uid = useId()

  const cast = async (v: 1 | -1) => {
    if (busy) return
    const next = vote === v ? 0 : v
    setBusy(true)
    setNoteState('idle')
    setAskedFor(next)
    setAnnounce(next === 1 ? 'Marked as useful. Thank you!' : next === -1 ? 'Marked as not useful. Thanks for the honesty.' : 'Vote removed.')
    const ok = await react(slug, next, vote)
    setBusy(false)
    if (!ok) {
      setAskedFor(0)
      setAnnounce('Could not save your vote. Please check your connection and try again.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim() || !vote) return
    setNoteState('sending')
    const ok = await sendReason(slug, vote, note.trim())
    setNoteState(ok ? 'sent' : 'error')
    setAnnounce(ok ? 'Feedback sent. Thank you!' : 'Could not send your feedback. Please try again.')
    if (ok) setNote('')
  }

  const likes = counts?.likes ?? 0
  const dislikes = counts?.dislikes ?? 0
  const showCounts = reactionsEnabled && !!counts

  return (
    <section className="b-react" aria-labelledby={`${uid}-t`}>
      <div className="b-react__row">
        <h2 className="b-react__title" id={`${uid}-t`}>
          Was this post useful?
        </h2>
        <div className="b-react__btns" role="group" aria-labelledby={`${uid}-t`}>
          <button
            type="button"
            className={`b-react__btn is-like ${vote === 1 ? 'is-on' : ''}`}
            aria-pressed={vote === 1}
            onClick={() => cast(1)}
            aria-label={`Useful${showCounts ? `, ${likes} ${likes === 1 ? 'reader' : 'readers'} found it useful` : ''}`}
          >
            <Icon name="like" size={18} filled={vote === 1} />
            <span>Useful</span>
            {showCounts && (
              <span className="b-react__n" aria-hidden="true">
                {fmt(likes)}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`b-react__btn is-dislike ${vote === -1 ? 'is-on' : ''}`}
            aria-pressed={vote === -1}
            onClick={() => cast(-1)}
            aria-label={`Not useful${showCounts ? `, ${dislikes} ${dislikes === 1 ? 'reader' : 'readers'} said not useful` : ''}`}
          >
            <Icon name="dislike" size={18} filled={vote === -1} />
            <span>Not really</span>
            {showCounts && (
              <span className="b-react__n" aria-hidden="true">
                {fmt(dislikes)}
              </span>
            )}
          </button>
        </div>
      </div>

      {askedFor !== 0 && vote !== 0 && reactionsEnabled && (
        <form className="b-react__form" onSubmit={submit}>
          {noteState === 'sent' ? (
            <p className="b-react__thanks">
              <Icon name="check" size={16} /> Got it, thank you. I read every note.
            </p>
          ) : (
            <>
              <label htmlFor={`${uid}-note`}>{vote === -1 ? 'What could be better? (optional)' : 'What helped most, or what should I write next? (optional)'}</label>
              <textarea
                id={`${uid}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 600))}
                rows={3}
                maxLength={600}
                placeholder={vote === -1 ? 'Too long, unclear, wrong, missing an example…' : 'A topic, a question, a follow-up…'}
                aria-describedby={`${uid}-hint`}
              />
              <div className="b-react__formfoot">
                <span id={`${uid}-hint`} className="b-react__hint">
                  Anonymous. {600 - note.length} characters left.
                </span>
                <button type="submit" className="b-btn is-sm" disabled={!note.trim() || noteState === 'sending'}>
                  {noteState === 'sending' ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
              {noteState === 'error' && (
                <p className="b-field-error" role="alert">
                  Could not send. Please try again, or email <a href={`mailto:iigulzaib@gmail.com?subject=${encodeURIComponent(`Feedback: ${title}`)}`}>iigulzaib@gmail.com</a>.
                </p>
              )}
            </>
          )}
        </form>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  )
}

/** Compact like count for cards (read-only). */
export function LikeCount({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="b-likes" aria-label={`${n} ${n === 1 ? 'reader' : 'readers'} found this useful`}>
      <Icon name="like" size={13} /> {fmt(n)}
    </span>
  )
}
