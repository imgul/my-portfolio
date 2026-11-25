import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFraction, scrollForFraction } from '../src/blog/reading-progress.ts'

test('progress stops when the body end reaches the viewport, not at the page footer', () => {
  const start = 100
  const end = 5100
  const viewport = 800
  assert.equal(readFraction(start, end, viewport, 100), 0)
  assert.equal(readFraction(start, end, viewport, 2200), 0.5)
  assert.ok(readFraction(start, end, viewport, 4299) < 1)
  assert.equal(readFraction(start, end, viewport, 4300), 1)
  assert.equal(readFraction(start, end, viewport, 7000), 1)
})

test('resume uses the same boundary, including after a viewport resize', () => {
  for (const viewport of [400, 900]) {
    const position = scrollForFraction(100, 5100, viewport, 0.6)
    assert.equal(readFraction(100, 5100, viewport, position), 0.6)
  }
})

test('short articles and out-of-range scroll positions remain bounded', () => {
  assert.equal(readFraction(100, 500, 900, 0), 0)
  assert.equal(readFraction(100, 500, 900, 101), 1)
  assert.equal(scrollForFraction(100, 500, 900, 5), 101)
})
