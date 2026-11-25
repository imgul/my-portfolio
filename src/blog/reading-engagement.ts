/** Conservative, in-memory estimate. Times are monotonic milliseconds, not wall-clock timestamps. */
const IDLE = 30_000
const MAX_GAP = 5_000
const MAX_ACTIVE = 20 * 60_000
const BINS = 10

export class ReadingEngagement {
  private last: number | undefined
  private lastInput: number | undefined
  private lastBurst: number | undefined
  private bursts = 0
  private active = 0
  private depth = 0
  private bins = Array<number>(BINS).fill(0)
  private previousDepth = 0

  /** A delayed timer, suspended device, hidden/unfocused tab or idle period cannot add time. */
  sample(now: number, eligible: boolean, depth: number) {
    if (!Number.isFinite(now)) return
    const validDepth = Number.isFinite(depth) ? Math.min(1, Math.max(0, depth)) : 0
    const elapsed = this.last === undefined ? 0 : now - this.last
    if (eligible && this.lastInput !== undefined && elapsed > 0 && elapsed <= MAX_GAP && now >= this.lastInput) {
      const activeUntil = Math.min(now, this.lastInput + IDLE)
      const delta = Math.max(0, activeUntil - (this.last ?? now))
      const add = Math.min(delta, MAX_ACTIVE - this.active)
      this.active += add
      this.bins[Math.min(BINS - 1, Math.floor(this.previousDepth * BINS))] += add
      if (add > 0) this.depth = Math.max(this.depth, validDepth)
    }
    this.last = now
    this.previousDepth = validDepth
  }

  input(now: number, eligible: boolean, depth: number) {
    this.sample(now, eligible, depth)
    if (eligible && Number.isFinite(now)) {
      if (this.lastBurst === undefined || now - this.lastBurst >= 4000) {
        this.lastBurst = now
        this.bursts = Math.min(100, this.bursts + 1)
      }
      this.lastInput = now
      this.depth = Math.max(this.depth, this.previousDepth)
    }
  }

  /** Pauses across focus/visibility changes without crediting the gap on return. */
  pause() {
    this.last = undefined
    this.lastInput = undefined
  }

  outcome(minutes: number, final = false): { kind: 'read' | 'skim'; strength: number } | undefined {
    const expected = Number.isFinite(minutes) ? Math.min(1800, Math.max(60, minutes * 60)) : 300
    const seconds = this.active / 1000
    const covered = this.bins.filter((ms) => ms >= 2000).length
    if (this.bursts >= 3 && seconds >= Math.max(15, Math.min(60, expected * 0.4)) && this.depth >= 0.95 && covered >= 4) return { kind: 'read', strength: 1 }
    if (this.bursts >= 2 && seconds >= 10 && this.depth >= 0.12 && covered >= 2) {
      const strength = Math.min(0.75, Math.max(0.1, Math.min(1, seconds / (expected * 0.5)) * Math.min(1, this.depth / 0.75)))
      return { kind: 'read', strength: strength >= 0.6 ? 0.75 : strength >= 0.3 ? 0.5 : 0.25 }
    }
    // A single short or inactive visit is not treated as a dislike. This is a small, reversible signal only.
    if (final && this.bursts >= 2 && seconds >= 15 && seconds < expected * 0.5 && this.depth >= 0.02 && this.depth < 0.25) return { kind: 'skim', strength: 0.25 }
  }
}
