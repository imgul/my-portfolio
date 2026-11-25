import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseActivities, RECOMMENDATION_MAX_AGE, RECOMMENDATION_MAX_EVENTS } from '../src/blog/recommendation-data.ts'

const now = Date.parse('2026-11-25T12:00:00Z')
const valid = { kind: 'search', slug: 'a-post', at: now, strength: 0.75 }

test('rejects invalid, expired and future events, and strips unexpected fields', () => {
  const input = [
    { ...valid, query: 'private text' },
    { ...valid, at: now - 1 },
    { ...valid, slug: 'old', at: now - RECOMMENDATION_MAX_AGE - 1 },
    { ...valid, slug: 'future', at: now + 1 },
    { ...valid, slug: 'not/a/slug' },
    { ...valid, kind: 'unknown' },
    { ...valid, strength: 3 },
    null,
  ]
  assert.deepEqual(parseActivities(JSON.stringify(input), now), [valid])
})

test('handles malformed storage and bounds the number of events', () => {
  assert.deepEqual(parseActivities('{', now), [])
  assert.deepEqual(parseActivities('x'.repeat(128_001), now), [])
  const many = Array.from({ length: 150 }, (_, i) => ({ ...valid, slug: `post-${i}`, at: now - i }))
  const parsed = parseActivities(JSON.stringify(many), now)
  assert.equal(parsed.length, RECOMMENDATION_MAX_EVENTS)
  assert.equal(parsed[0].slug, 'post-0')
  assert.equal(parsed.at(-1).slug, 'post-99')
})
