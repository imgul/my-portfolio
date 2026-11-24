/**
 * Link previews for every link on the site, set up once per app.
 *
 *  Mouse / pen  hover a link (about 0.4 s) → card. Moving to the card keeps it
 *               open; once one card has opened, moving to other links swaps
 *               cards almost instantly (like tooltips in native apps).
 *  Keyboard     tab to a link → card after a short pause; Esc closes.
 *  Touch        first tap → card (a bottom sheet on phones), second tap
 *               or "Open" → follow the link. Swipe the sheet down to close.
 *
 * Any link works: other sites (fetched live when the build missed them, then
 * cached in the browser), this site's pages, files, email / phone / WhatsApp,
 * and in-page links (#section shows the section, [1] shows the cited work).
 * Links that stay on screen are prefetched lazily while the browser is idle.
 *
 * Event delegation on the document, so new links work without any changes.
 * Opt out with data-no-preview on a link or container; data-preview="hover"
 * keeps the hover card but lets a tap follow the link straight away.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { inPageTarget, prefetch, prefetchManifest, resolve, urlOf, warmImages, watchLinks, type Preview } from './data'
import { playSfx, unlockSfx } from './sfx'
import './linkPreview.css'

export interface LinkPreviewFeedback {
  /** are UI sounds on? (checked each time) */
  sound?: () => boolean
  /** vibration / iOS haptic tick */
  haptic?: (p: 'tick' | 'tap' | 'click' | 'success') => void
}

interface Props {
  theme: 'portfolio' | 'blog'
  feedback?: LinkPreviewFeedback
  reducedMotion?: () => boolean
}

type Mode = 'hover' | 'focus' | 'touch'
interface Open {
  id: number
  anchor: HTMLAnchorElement
  preview: Preview
  mode: Mode
  sheet: boolean
  /** pointer position when it opened (picks the right line of a wrapped link) */
  px?: number
  py?: number
  /** swapped from another card: glide instead of pop */
  glide: boolean
}
interface Pos {
  x: number
  y: number
  side: 'above' | 'below'
  ax: number
}

const OPEN_DELAY = 380
const WARM_DELAY = 70
const FOCUS_DELAY = 450
const CLOSE_GRACE = 240
const WARM_WINDOW = 650
const SHEET_QUERY = '(max-width: 640px)'
const SHARE =
  /(?:twitter|x)\.com\/intent|linkedin\.com\/(?:sharing|shareArticle)|facebook\.com\/sharer|reddit\.com\/submit|news\.ycombinator\.com\/submitlink|bsky\.app\/intent|(?:wa\.me|api\.whatsapp\.com\/send)\/?\?text=|t\.me\/share/i

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), Math.max(a, b))

function anchorFrom(t: EventTarget | null): HTMLAnchorElement | null {
  const el = t instanceof Element ? t : t instanceof Node ? t.parentElement : null
  const a = el?.closest?.('a[href]')
  return a instanceof HTMLAnchorElement ? a : null
}

/** In-page links that are navigation, not content (TOC, skip links, heading anchors, footnote back-links). */
const IN_PAGE_SKIP = 'nav, body > header, [role="banner"], [role="navigation"], [role="tablist"], .b-toc, .b-h__anchor, .b-skip, .skip-link, [data-footnote-backref], .footnote-backref, h1, h2, h3, h4, h5, h6'

function eligible(a: HTMLAnchorElement): boolean {
  if (!a.isConnected || a.closest('[data-no-preview], .lp')) return false
  const raw = (a.getAttribute('href') || '').trim()
  if (!raw || raw === '#' || /^javascript:/i.test(raw)) return false
  if (raw.startsWith('#') || (a.hash && a.origin === location.origin && a.pathname === location.pathname && a.search === location.search)) {
    if (a.closest(IN_PAGE_SKIP) || /^#(top|main|content|root)$/i.test(a.hash)) return false
    return !!inPageTarget(a)
  }
  const u = urlOf(a)
  if (!u || !/^(https?|mailto|tel):$/.test(u.protocol)) return false
  if (SHARE.test(u.href)) return false
  // links to the page you're on (logo, current nav tab, in-page anchors)
  if (u.origin === location.origin && u.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '') && u.search === location.search) return false
  return true
}

const hoverOnly = (a: HTMLAnchorElement) => !!a.closest('[data-preview="hover"]')
const isSheet = () => window.matchMedia(SHEET_QUERY).matches

/* ================================================================ component */

export default function LinkPreviews({ theme, feedback, reducedMotion }: Props) {
  const [open, setOpen] = useState<Open | null>(null)
  const [closing, setClosing] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const [copied, setCopied] = useState(false)
  const [drag, setDrag] = useState(0)

  const cardRef = useRef<HTMLDivElement>(null)
  const st = useRef({
    open: null as Open | null,
    openTimer: 0,
    closeTimer: 0,
    exitTimer: 0,
    pending: null as HTMLAnchorElement | null,
    lastClose: 0,
    lastPointer: 'mouse' as string,
    px: 0,
    py: 0,
    seq: 0,
    passThrough: null as HTMLAnchorElement | null,
    side: null as Pos['side'] | null,
    describedBy: null as string | null,
  })
  const fb = useRef(feedback)
  fb.current = feedback
  const rm = useRef(reducedMotion)
  rm.current = reducedMotion

  const sound = (s: Parameters<typeof playSfx>[0]) => {
    if (fb.current?.sound?.()) playSfx(s)
  }
  const haptic = (p: 'tick' | 'tap' | 'click' | 'success') => fb.current?.haptic?.(p)

  /* ---------------------------------------------------------------- open */

  const clearTimers = () => {
    const s = st.current
    clearTimeout(s.openTimer)
    clearTimeout(s.closeTimer)
    s.pending = null
  }

  const restoreDescribedBy = (o: Open | null) => {
    if (!o) return
    // give the native tooltip back
    const t = o.anchor.getAttribute('data-lp-title')
    if (t !== null) {
      o.anchor.setAttribute('title', t)
      o.anchor.removeAttribute('data-lp-title')
    }
    const s = st.current
    if (s.describedBy === null) o.anchor.removeAttribute('aria-describedby')
    else o.anchor.setAttribute('aria-describedby', s.describedBy)
  }

  const show = useCallback((anchor: HTMLAnchorElement, mode: Mode) => {
    const s = st.current
    const r = resolve(anchor)
    if (!r) return
    const prev = s.open
    const id = ++s.seq
    const sheet = mode === 'touch' && isSheet()
    const glide = !!prev && !prev.sheet && !sheet && prev.anchor !== anchor
    restoreDescribedBy(prev)
    // the card replaces the native title tooltip while it's open (no double tooltips)
    const title = anchor.getAttribute('title')
    if (title !== null) {
      anchor.setAttribute('data-lp-title', title)
      anchor.removeAttribute('title')
    }
    if (mode === 'focus') {
      s.describedBy = anchor.getAttribute('aria-describedby')
      anchor.setAttribute('aria-describedby', 'lp-card')
    }
    s.side = null
    const next: Open = {
      id,
      anchor,
      preview: r.now,
      mode,
      sheet,
      px: mode === 'focus' ? undefined : s.px,
      py: mode === 'focus' ? undefined : s.py,
      glide,
    }
    s.open = next
    clearTimeout(s.exitTimer)
    if (!glide) setPos(null)
    setClosing(false)
    setCopied(false)
    setDrag(0)
    setOpen(next)
    warmImages(r.now)
    r.later?.then((p) => {
      if (st.current.open?.id !== id) return
      warmImages(p)
      const upd = { ...st.current.open, preview: p }
      st.current.open = upd
      setOpen(upd)
    })
    if (mode === 'touch') {
      haptic('tick')
      sound('open')
    } else sound(glide ? 'move' : 'open')
  }, [])

  const close = useCallback((opts: { instant?: boolean; silent?: boolean } = {}) => {
    const s = st.current
    clearTimers()
    const o = s.open
    if (!o) return
    restoreDescribedBy(o)
    s.open = null
    s.lastClose = performance.now()
    if (!opts.silent && o.mode === 'touch') sound('close')
    if (opts.instant) {
      setOpen(null)
      setClosing(false)
      setPos(null)
      return
    }
    setClosing(true)
    clearTimeout(s.exitTimer)
    s.exitTimer = window.setTimeout(
      () => {
        setOpen(null)
        setClosing(false)
        setPos(null)
      },
      o.sheet ? 240 : 160,
    )
  }, [])

  /** follow the link exactly as a normal click would (router, target, fx) */
  const go = useCallback(
    (e?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; button?: number; preventDefault?: () => void }) => {
      const o = st.current.open
      if (!o) return
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || (e.button ?? 0) !== 0)) return // let the browser open a new tab
      e?.preventDefault?.()
      haptic('click')
      sound('go')
      st.current.passThrough = o.anchor
      close({ silent: true })
      o.anchor.click()
      st.current.passThrough = null
    },
    [close],
  )

  /* ------------------------------------------------------ global listeners */

  useEffect(() => {
    prefetchManifest()
    const unwatch = watchLinks(eligible)
    const s = st.current
    const inCard = (t: EventTarget | null) => t instanceof Node && !!cardRef.current?.contains(t)

    const schedule = (a: HTMLAnchorElement, mode: Mode) => {
      clearTimeout(s.openTimer)
      clearTimeout(s.closeTimer)
      if (s.open?.anchor === a) return
      s.pending = a
      // pull the manifest + images early so the card opens complete
      const warm = !!s.open || performance.now() - s.lastClose < WARM_WINDOW
      const delay = mode === 'focus' ? FOCUS_DELAY : warm ? WARM_DELAY : OPEN_DELAY
      s.openTimer = window.setTimeout(() => {
        if (s.pending !== a || !a.isConnected) return
        s.pending = null
        show(a, mode)
      }, delay)
      const r = resolve(a)
      if (r) warmImages(r.now)
    }
    const scheduleClose = (delay = CLOSE_GRACE) => {
      clearTimeout(s.closeTimer)
      s.closeTimer = window.setTimeout(() => close(), delay)
    }

    const onPointerDown = (e: PointerEvent) => {
      s.lastPointer = e.pointerType
      s.px = e.clientX
      s.py = e.clientY
      if (fb.current?.sound?.()) unlockSfx()
      // a finger on a link: start loading its card before the tap completes
      if (e.pointerType === 'touch') {
        const t = anchorFrom(e.target)
        if (t && !inCard(e.target) && eligible(t)) prefetch(t, 'now')
      }
      if (!s.open || inCard(e.target)) return
      // tap/click elsewhere closes; a tap on another link is handled by onClick
      const a = anchorFrom(e.target)
      if (e.pointerType === 'touch' && a && eligible(a) && !hoverOnly(a)) return
      if (a && a === s.open.anchor && e.pointerType !== 'touch') return close({ instant: true, silent: true })
      close()
    }

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      s.px = e.clientX
      s.py = e.clientY
      if (inCard(e.target)) {
        clearTimeout(s.closeTimer)
        return
      }
      const a = anchorFrom(e.target)
      if (a && eligible(a)) {
        if (s.open?.mode === 'touch' && s.open.sheet) return
        schedule(a, 'hover')
      }
    }
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const to = e.relatedTarget instanceof Node ? e.relatedTarget : null
      const from = e.target instanceof Node ? e.target : null
      if (inCard(to)) return
      const within = (el: Element | null) => !!el && !!from && el.contains(from) && !(to && el.contains(to))
      // left the link we were about to open: cancel it
      if (s.pending && within(s.pending)) {
        clearTimeout(s.openTimer)
        s.pending = null
        if (s.open?.mode === 'hover') scheduleClose()
      }
      const o = s.open
      if (o && o.mode === 'hover' && (within(o.anchor) || (inCard(from) && !inCard(to)))) scheduleClose()
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      s.px = e.clientX
      s.py = e.clientY
    }

    const onClick = (e: MouseEvent) => {
      const a = anchorFrom(e.target)
      if (!a || inCard(e.target)) return
      if (s.passThrough === a) return
      const touch = s.lastPointer === 'touch' && e.detail > 0
      if (!touch) {
        if (s.open) close({ instant: true, silent: true })
        return
      }
      if (!eligible(a) || hoverOnly(a) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        if (s.open) close({ silent: true })
        return
      }
      if (s.open?.anchor === a) {
        // second tap: follow the link
        haptic('click')
        sound('go')
        close({ silent: true })
        return
      }
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      clearTimers()
      show(a, 'touch')
    }

    const onFocusIn = (e: FocusEvent) => {
      if (inCard(e.target)) {
        clearTimeout(s.closeTimer)
        return
      }
      const a = anchorFrom(e.target)
      if (!a || !eligible(a)) return
      let visible = true
      try {
        visible = a.matches(':focus-visible')
      } catch {
        /* old browsers */
      }
      if (visible && s.lastPointer !== 'touch') schedule(a, 'focus')
    }
    const onFocusOut = (e: FocusEvent) => {
      if (inCard(e.relatedTarget)) return
      if (s.pending && anchorFrom(e.target) === s.pending) {
        clearTimeout(s.openTimer)
        s.pending = null
      }
      if (s.open?.mode === 'focus') scheduleClose(80)
    }

    const onKey = (e: KeyboardEvent) => {
      s.lastPointer = 'keyboard'
      if (e.key === 'Escape' && (s.open || s.pending)) {
        const o = s.open
        const hadFocus = inCard(document.activeElement)
        clearTimers()
        if (o) {
          close()
          if (hadFocus) o.anchor.focus({ preventScroll: true })
        }
      }
    }

    const onScroll = (e: Event) => {
      const o = s.open
      if (!o || o.sheet) return
      if (inCard(e.target)) return
      if (o.mode === 'hover') {
        // wheel over the card itself shouldn't close it
        if (cardRef.current?.matches(':hover')) return
        close()
      }
    }
    const onHide = () => s.open && close({ instant: true, silent: true })
    const onVis = () => document.hidden && onHide()

    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', onPointerDown, opts)
    window.addEventListener('pointerover', onOver, opts)
    window.addEventListener('pointerout', onOut, opts)
    window.addEventListener('pointermove', onMove, opts)
    window.addEventListener('click', onClick, true)
    window.addEventListener('focusin', onFocusIn, true)
    window.addEventListener('focusout', onFocusOut, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, opts)
    window.addEventListener('blur', onHide)
    window.addEventListener('popstate', onHide)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimers()
      unwatch()
      window.removeEventListener('pointerdown', onPointerDown, opts)
      window.removeEventListener('pointerover', onOver, opts)
      window.removeEventListener('pointerout', onOut, opts)
      window.removeEventListener('pointermove', onMove, opts)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('focusin', onFocusIn, true)
      window.removeEventListener('focusout', onFocusOut, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, opts)
      window.removeEventListener('blur', onHide)
      window.removeEventListener('popstate', onHide)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [show, close])

  /* ------------------------------------------------------------ position */

  const place = useCallback(() => {
    const o = st.current.open
    const card = cardRef.current
    if (!o || !card || o.sheet) return
    if (!o.anchor.isConnected) return close({ instant: true, silent: true })
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const rects = [...o.anchor.getClientRects()].filter((r) => r.width > 0 || r.height > 0)
    if (!rects.length) return close({ instant: true, silent: true })
    // a link that wraps over two lines: use the line under the pointer
    const r = (o.py !== undefined && rects.find((q) => o.py! >= q.top - 2 && o.py! <= q.bottom + 2)) || rects[0]
    if (o.mode === 'touch' && (r.bottom < 0 || r.top > vh)) return close()
    const w = card.offsetWidth
    const h = card.offsetHeight
    const gap = 10
    const m = 8
    const below = vh - r.bottom - gap - m
    const above = r.top - gap - m
    let side = st.current.side
    if (!side || (side === 'below' && below < h && above > below) || (side === 'above' && above < h && below > above)) {
      side = below >= h || below >= above ? 'below' : 'above'
      st.current.side = side
    }
    const y = clamp(side === 'below' ? r.bottom + gap : r.top - gap - h, m, vh - h - m)
    const cx = o.px !== undefined && o.mode === 'hover' ? clamp(o.px, r.left + 6, r.right - 6) : (r.left + r.right) / 2
    const x = clamp(cx - w / 2, 12, vw - w - 12)
    const ax = clamp(cx - x, 20, w - 20)
    setPos((p) => (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 && p.side === side && Math.abs(p.ax - ax) < 0.5 ? p : { x, y, side, ax }))
  }, [close])

  useLayoutEffect(() => {
    if (!open || open.sheet) return
    place()
  }, [open, place])

  useEffect(() => {
    if (!open || open.sheet || closing) return
    const card = cardRef.current
    const ro = new ResizeObserver(() => place())
    if (card) ro.observe(card)
    let raf = 0
    const tick = () => {
      raf = 0
      place()
    }
    const onMoveView = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('resize', onMoveView)
    // touch cards follow their link while the page scrolls
    if (open.mode !== 'hover')
      window.addEventListener('scroll', onMoveView, {
        capture: true,
        passive: true,
      })
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onMoveView)
      window.removeEventListener('scroll', onMoveView, { capture: true })
    }
  }, [open?.id, open?.sheet, open?.mode, closing, place])

  /* ----------------------------------------------------- sheet swipe-down */

  const dragRef = useRef<{
    y: number
    t: number
    id: number
    dy: number
  } | null>(null)
  const dragged = useRef(0)
  const onSheetDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!open?.sheet || closing || (e.target as Element).closest('button')) return
    dragRef.current = {
      y: e.clientY,
      t: performance.now(),
      id: e.pointerId,
      dy: 0,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onSheetMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.y
    // resist upward drags, follow downward ones
    d.dy = dy > 0 ? dy : dy / 6
    setDrag(d.dy)
  }
  const onSheetUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    dragRef.current = null
    if (Math.abs(d.dy) > 6) dragged.current = performance.now()
    const v = d.dy / Math.max(1, performance.now() - d.t)
    if (d.dy > 90 || (d.dy > 24 && v > 0.45)) {
      haptic('tap')
      close()
    } else setDrag(0)
  }

  /* --------------------------------------------------------------- render */

  if (!open || typeof document === 'undefined') return null
  const p = open.preview
  const touch = open.mode === 'touch'
  const reduce = rm.current?.() ?? false

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.href)
      setCopied(true)
      haptic('success')
      sound('copy')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }
  const canShare = touch && typeof navigator.share === 'function' && /^https?:/.test(p.href)
  const share = () => {
    haptic('tap')
    void navigator.share({ title: p.title, url: p.href }).catch(() => {})
  }

  const style: CSSProperties & Record<string, string | number> = {}
  if (p.color) style['--lp-c'] = p.color
  if (!open.sheet) {
    if (pos) {
      style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)`
      style['--lp-ax'] = `${Math.round(pos.ax)}px`
    } else style.visibility = 'hidden'
  } else if (drag) {
    style['--lp-drag'] = `${Math.round(drag)}px`
  }

  const cls = [
    'lp',
    `lp--${theme}`,
    `lp--k-${p.kind}`,
    open.sheet ? 'lp--sheet' : 'lp--pop',
    touch && 'is-touch',
    pos && !open.sheet && `is-${pos.side}`,
    closing ? 'is-closing' : 'is-open',
    open.glide && 'is-glide',
    reduce && 'is-reduced',
    drag && 'is-dragging',
  ]
    .filter(Boolean)
    .join(' ')

  const hint = p.hint || (p.kind === 'email' ? 'opens your mail app' : p.kind === 'phone' ? 'starts a call' : open.anchor.target === '_blank' ? 'new tab' : '')

  return createPortal(
    <>
      {open.sheet && <div className={`lp-scrim lp-scrim--${theme} ${closing ? 'is-closing' : ''}`} aria-hidden="true" />}
      <div
        ref={cardRef}
        id="lp-card"
        className={cls}
        style={style}
        role={touch ? 'dialog' : 'tooltip'}
        aria-label={touch ? `Link preview: ${p.title}` : undefined}
        aria-busy={p.loading || undefined}
        data-no-preview=""
        onPointerEnter={() => clearTimeout(st.current.closeTimer)}
        onPointerDown={onSheetDown}
        onPointerMove={onSheetMove}
        onPointerUp={onSheetUp}
        onPointerCancel={onSheetUp}
      >
        <div className="lp-panel" key={open.id}>
          {open.sheet && <div className="lp-grab" aria-hidden="true" />}
          {p.loading && <span className="lp-progress" aria-hidden="true" />}
          <a
            className="lp-hit"
            href={p.href}
            target={open.anchor.target || undefined}
            rel={open.anchor.rel || undefined}
            tabIndex={touch ? 0 : -1}
            data-cursor="Open"
            onClick={(e) => {
              if (performance.now() - dragged.current < 300) return e.preventDefault()
              go(e)
            }}
            draggable={false}
          >
            <Media p={p} />
            <div className="lp-body">
              <div className="lp-site">
                <Badge p={p} />
                <span className="lp-site__name">{p.site}</span>
                {p.external && p.kind !== 'email' && p.kind !== 'phone' && <ExtIcon />}
              </div>
              <div className="lp-head">
                {p.avatar && <Img className="lp-avatar" src={p.avatar} alt="" />}
                <strong className="lp-title">{p.title}</strong>
              </div>
              {p.loading ? (
                <span className="lp-skel" aria-hidden="true">
                  <i />
                  <i />
                </span>
              ) : (
                p.description && <span className="lp-desc">{p.description}</span>
              )}
              {p.failed && (
                <span className="lp-note" role="status">
                  {p.failed === 'offline' ? 'You’re offline: showing what the link itself says.' : 'Couldn’t load more details for this link.'}
                </span>
              )}
              {p.list && p.list.length > 0 && (
                <span className="lp-list">
                  {p.list.map((it) => (
                    <span key={it.title} className="lp-list__item" style={it.color ? ({ '--lp-c': it.color } as CSSProperties) : undefined}>
                      <i aria-hidden="true" />
                      <span className="lp-list__t">{it.title}</span>
                      <span className="lp-list__m">{it.meta}</span>
                    </span>
                  ))}
                </span>
              )}
              {p.chips.length > 0 && (
                <span className="lp-chips">
                  {p.chips.slice(0, 4).map((c, i) => (
                    <span key={c} className={`lp-chip ${i === 0 && p.kind === 'post' ? 'lp-chip--cat' : ''}`}>
                      {c}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </a>
          {touch ? (
            <div className="lp-actions">
              <button type="button" className="lp-btn lp-btn--go" onClick={() => go()}>
                {p.action}
                <ArrowIcon />
              </button>
              <button type="button" className={`lp-btn lp-btn--icon ${copied ? 'is-done' : ''}`} onClick={copy} aria-label={copied ? 'Link copied' : 'Copy link'} title="Copy link">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              {canShare && (
                <button type="button" className="lp-btn lp-btn--icon" onClick={share} aria-label="Share link" title="Share">
                  <ShareIcon />
                </button>
              )}
            </div>
          ) : (
            <div className="lp-foot">
              <span className="lp-url">{p.display}</span>
              {hint && <span className="lp-hint">{hint}</span>}
            </div>
          )}
          {touch && !open.sheet && <span className="lp-tip">Tap the link again to open</span>}
          {open.sheet && <span className="lp-url lp-url--sheet">{p.display}</span>}
        </div>
        {!open.sheet && <span className="lp-arrow" aria-hidden="true" />}
      </div>
    </>,
    document.body,
  )
}

/* ============================================================ pieces */

/** Images load lazily (only when a card shows them), decode off the main thread and fade in; failures disappear. */
function Img({ src, className, alt, onFail }: { src: string; className: string; alt: string; onFail?: () => void }) {
  const [state, setState] = useState<'load' | 'ok' | 'err'>('load')
  useEffect(() => setState('load'), [src])
  if (state === 'err') return null
  return (
    <img
      className={`${className} is-${state}`}
      src={src}
      alt={alt}
      decoding="async"
      loading="lazy"
      fetchPriority="low"
      referrerPolicy="no-referrer"
      draggable={false}
      onLoad={() => setState('ok')}
      onError={() => {
        setState('err')
        onFail?.()
      }}
    />
  )
}

function Media({ p }: { p: Preview }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [p.image])
  if (p.kind === 'file' || p.kind === 'feed') {
    return (
      <span className="lp-doc" aria-hidden="true">
        <span className="lp-doc__page">
          <span className="lp-doc__fold" />
          <span className="lp-doc__lines">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="lp-doc__ext">{p.kind === 'feed' ? 'FEED' : (p.file || 'file').toUpperCase()}</span>
        </span>
      </span>
    )
  }
  if (!p.image || failed || p.avatar === p.image) return null
  const mod = p.kind === 'post' ? 'lp-media--og' : p.kind === 'image' ? 'lp-media--image' : p.kind === 'video' ? 'lp-media--video' : ''
  return (
    <span className={`lp-media ${mod}`}>
      <Img className="lp-media__img" src={p.image} alt={p.imageAlt ?? ''} onFail={() => setFailed(true)} />
      {p.kind === 'video' && (
        <span className="lp-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 7.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L9.9 6.7a.6.6 0 0 0-.9.5Z" />
          </svg>
        </span>
      )}
    </span>
  )
}

const GLYPH: Partial<Record<Preview['kind'], ReactElement>> = {
  email: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 3.5h2.6l1.4 4-2 1.3a12 12 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.5 20.5l4.2-1.1A8.5 8.5 0 1 0 12 3.5Z" />
      <path d="M9 8.7c.3 2.9 2.4 5.2 5.4 6l1.1-1.3-1.8-1-.8.8a4.6 4.6 0 0 1-2.3-2.3l.8-.8-1-1.8Z" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" />
      <circle cx="6" cy="18" r="1.4" />
    </svg>
  ),
  section: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14M5 12h10M5 18h7" />
    </svg>
  ),
  cite: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 7.5H6.8A1.8 1.8 0 0 0 5 9.3V12h4.5v4.5H5M19 7.5h-2.7a1.8 1.8 0 0 0-1.8 1.8V12H19v4.5h-4.5" />
    </svg>
  ),
  topic: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4 7 20M17 4l-2 16M4.5 9h15M4 15h15" />
    </svg>
  ),
}

function Badge({ p }: { p: Preview }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [p.icon])
  const glyph = GLYPH[p.kind]
  if (glyph && !(p.kind === 'feed' && p.icon)) return <span className="lp-badge lp-badge--glyph">{glyph}</span>
  if (p.icon && !failed) {
    return (
      <span className="lp-badge">
        <img src={p.icon} alt="" width={16} height={16} decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(true)} />
      </span>
    )
  }
  const letter = (p.site.replace(/^(the|www)\s*/i, '')[0] || '•').toUpperCase()
  return (
    <span className="lp-badge lp-badge--mono" aria-hidden="true">
      {letter}
    </span>
  )
}

const ExtIcon = () => (
  <svg className="lp-ext" viewBox="0 0 16 16" aria-label="external site" role="img">
    <path d="M6 3.5h6.5V10M12.2 3.8 4 12" />
  </svg>
)
const ArrowIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h9.5M8.5 4l4 4-4 4" />
  </svg>
)
const CopyIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
    <path d="M10.5 3.2A1.7 1.7 0 0 0 9 2.5H4.2a1.7 1.7 0 0 0-1.7 1.7V9a1.7 1.7 0 0 0 .7 1.4" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
)
const ShareIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 10V2.5M5 5.2 8 2.3l3 2.9M4.5 7.5h-1v6h9v-6h-1" />
  </svg>
)
