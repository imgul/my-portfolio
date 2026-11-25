import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recommendPosts } from '../src/blog/recommendations.ts'

const now = Date.parse('2026-11-25T12:00:00Z')
const post = (slug, category, tags, more = {}) => ({ slug, title: slug.replaceAll('-', ' '), category, tags, date: '2026-11-01', featured: false, ...more })
const catalogue = [
  post('laravel-queues', 'Engineering', ['laravel', 'queues']),
  post('laravel-agents', 'Engineering', ['laravel', 'agents']),
  post('ai-agents', 'AI Research', ['agents', 'ai']),
  post('school-sales', 'Founder', ['schools', 'sales']),
  post('school-setup', 'Founder', ['schools', 'erp']),
  post('unpublished-post', 'Founder', ['schools'], { scheduled: true }),
  post('draft-post', 'Founder', ['schools'], { draft: true }),
]
const event = (kind, slug, age = 0, strength = 1) => ({ kind, slug, strength, at: now - age * 86400000 })
const recommend = (history, options = {}) => recommendPosts(catalogue, history, { now, limit: 4, ...options })

test('personal activity changes results, excludes saved/read/disliked posts, and gives an honest reason', () => {
  const results = recommend([event('save', 'laravel-queues'), event('read', 'ai-agents'), event('dislike', 'school-sales')])
  const slugs = results.map((r) => r.post.slug)
  assert.equal(slugs[0], 'laravel-agents')
  assert.ok(!slugs.includes('laravel-queues') && !slugs.includes('ai-agents') && !slugs.includes('school-sales'))
  assert.ok(results[0].personalized)
  assert.match(results[0].reason, /Related to|Because you saved/)
})

test('cold start and expired, unknown, future or malformed signals do not personalize', () => {
  const fallback = recommend([])
  assert.deepEqual(recommend([event('save', 'school-sales', 91), event('save', 'missing'), event('search', 'school-setup', -1), event('read', 'laravel-queues', 0, NaN), { ...event('save', 'school-sales'), kind: '__proto__' }, null]), fallback)
  assert.ok(fallback.every((r) => !r.personalized))
  assert.ok(fallback.every((r) => !r.post.draft && !r.post.scheduled))
})

test('recent search matches and share attempts affect ranking without exposing raw queries', () => {
  const searched = recommend([event('search', 'school-sales')])
  assert.equal(searched[0].post.slug, 'school-sales')
  assert.equal(searched[0].reason, 'Related to a recent search')
  const shared = recommend([event('share', 'school-sales')])
  assert.equal(shared[0].post.slug, 'school-setup')
  assert.match(shared[0].reason, /tried to share/)
})

test('an old isolated signal has less influence than a recent one', () => {
  const list = [
    post('source', 'Engineering', ['laravel'], { date: '2025-01-01' }),
    post('relevant', 'Engineering', ['laravel'], { date: '2025-01-01' }),
    post('fresh', 'Founder', ['schools'], { date: '2026-11-25', featured: true }),
  ]
  assert.equal(recommendPosts(list, [event('search', 'source', 0, 0.75)], { now, limit: 1 })[0].post.slug, 'source')
  assert.equal(recommendPosts(list, [event('search', 'source', 89, 0.75)], { now, limit: 1 })[0].post.slug, 'fresh')
})

test('context excludes itself; next series part is favoured and output is deterministic', () => {
  const list = [
    post('part-one', 'Engineering', ['laravel'], { series: 'Guide', seriesPart: 1 }),
    post('part-two', 'Engineering', ['laravel'], { series: 'Guide', seriesPart: 2 }),
    post('another', 'Engineering', ['laravel']),
  ]
  const options = { now, context: list[0], limit: 3 }
  const results = recommendPosts(list, [], options)
  assert.equal(results[0].post.slug, 'part-two')
  assert.ok(results.every((r) => r.post.slug !== 'part-one'))
  assert.deepEqual(recommendPosts(list, [], options), results)
})

test('diversity reduces near-duplicate recommendations when relevance is similar', () => {
  const list = [
    post('anchor', 'Engineering', ['laravel', 'ai']),
    post('similar-one', 'Engineering', ['laravel', 'ai']),
    post('similar-two', 'Engineering', ['laravel', 'ai']),
    post('zz-different', 'Engineering', ['laravel', 'ai']),
  ]
  const results = recommendPosts(list, [event('read', 'anchor', 0, 0.75)], { now, limit: 3 })
  assert.equal(results[0].post.slug, 'similar-one')
  assert.equal(results[1].post.slug, 'zz-different')
})

test('dislikes demote related topics and exclude the disliked post; brief visits are weaker and do not exclude', () => {
  const list = [
    post('anchor', 'Engineering', ['laravel', 'queue']),
    post('similar', 'Engineering', ['laravel', 'queue']),
    post('different', 'Founder', ['schools']),
  ]
  const disliked = recommendPosts(list, [event('dislike', 'anchor')], { now, limit: 3 })
  assert.deepEqual(disliked.map((r) => r.post.slug), ['different', 'similar'])
  assert.ok(disliked[1].personalized)
  assert.match(disliked[1].reason, /Adjusted/)
  const brief = recommendPosts(list, [event('skim', 'anchor', 0, 0.25)], { now, limit: 3 })
  assert.ok(brief.some((r) => r.post.slug === 'anchor'))
  assert.ok(brief.findIndex((r) => r.post.slug === 'different') < brief.findIndex((r) => r.post.slug === 'similar'))
})

test('duplicate events cannot amplify a signal', () => {
  const single = event('dislike', 'school-sales')
  assert.deepEqual(recommend(Array(500).fill(single)), recommend([single]))
})
