import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ReadingEngagement } from '../src/blog/reading-engagement.ts'

const advance = (session, from, seconds, depth, inputEvery = 5, eligible = true) => {
  for (let i = 1; i <= seconds; i++) {
    const t = from + i * 1000
    if (i % inputEvery === 0) session.input(t, eligible, depth)
    else session.sample(t, eligible, depth)
  }
  return from + seconds * 1000
}

test('an unattended, hidden or paused tab adds no reading or low-retention signal', () => {
  const idle = new ReadingEngagement()
  advance(idle, 0, 600, 0.9)
  assert.equal(idle.outcome(5, true), undefined)
  const hidden = new ReadingEngagement()
  hidden.input(0, true, 0.1)
  hidden.pause()
  advance(hidden, 0, 600, 0.9, 5, false)
  hidden.pause()
  assert.equal(hidden.outcome(5, true), undefined)
})

test('idle cutoff, large timer gaps and clock anomalies cannot manufacture a read', () => {
  const s = new ReadingEngagement()
  s.input(0, true, 0.1)
  s.sample(600_000, true, 1)
  s.sample(-1, true, 1)
  s.sample(Number.NaN, true, 1)
  assert.equal(s.outcome(5, true), undefined)
  const idle = new ReadingEngagement()
  idle.input(0, true, 0)
  advance(idle, 0, 100, 0, Infinity)
  assert.equal(idle.outcome(5, true), undefined)
  const oneInput = new ReadingEngagement()
  oneInput.input(0, true, 0.1)
  advance(oneInput, 0, 600, 0.1, Infinity)
  assert.equal(oneInput.outcome(5, true), undefined, 'a single movement followed by an open tab is not a brief visit')
})

test('brief engagement is weak evidence, but a quick bounce is ignored', () => {
  const short = new ReadingEngagement()
  short.input(0, true, 0.1)
  advance(short, 0, 8, 0.1)
  assert.equal(short.outcome(5, true), undefined)
  const brief = new ReadingEngagement()
  brief.input(0, true, 0.1)
  advance(brief, 0, 20, 0.1)
  assert.equal(brief.outcome(5), undefined)
  assert.deepEqual(brief.outcome(5, true), { kind: 'skim', strength: 0.25 })
})

test('a fast end jump is not a completed read, even with time at the end', () => {
  const s = new ReadingEngagement()
  s.input(0, true, 0)
  let t = advance(s, 0, 20, 0)
  s.input(t, true, 1)
  t = advance(s, t, 60, 1)
  assert.notEqual(s.outcome(5)?.strength, 1)
})

test('engaged reading across bands can complete, with invalid inputs bounded', () => {
  const s = new ReadingEngagement()
  s.input(0, true, 0)
  let t = 0
  for (const depth of [0.05, 0.2, 0.4, 0.6, 0.8, 1]) {
    s.input(t, true, depth)
    t = advance(s, t, 12, depth)
  }
  assert.deepEqual(s.outcome(2), { kind: 'read', strength: 1 })
  const x = new ReadingEngagement()
  x.input(0, true, NaN)
  advance(x, 0, 20, Infinity)
  assert.equal(x.outcome(Infinity, true), undefined)
})

test('idle credit stops at 30 seconds and an active session is capped at 20 minutes', () => {
  const idle = new ReadingEngagement()
  idle.input(0, true, 0.1)
  advance(idle, 0, 120, 0.1, Infinity)
  assert.equal(idle.active, 30_000)
  const active = new ReadingEngagement()
  active.input(0, true, 0.1)
  advance(active, 0, 1800, 0.1)
  assert.equal(active.active, 20 * 60_000)
})
