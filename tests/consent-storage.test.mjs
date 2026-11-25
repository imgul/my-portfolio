import assert from 'node:assert/strict'
import { test } from 'node:test'

const values = new Map()
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
}
globalThis.window = new EventTarget()
globalThis.localStorage = storage
const { CONSENT_KEY, CONSENT_VERSION, OPTIONAL_KEYS, optionalAllowed, readConsent, saveConsent } = await import('../src/lib/consent/consent.ts')

test('optional storage remains off without a current explicit choice', () => {
  assert.equal(readConsent(), null)
  assert.equal(optionalAllowed(), false)
  storage.setItem(CONSENT_KEY, JSON.stringify({ choice: 'all', v: CONSENT_VERSION - 1 }))
  assert.equal(optionalAllowed(), false)
})

test('accept and reject preserve the existing consent semantics', () => {
  saveConsent('all')
  assert.equal(optionalAllowed(), true)
  assert.equal(readConsent()?.v, CONSENT_VERSION)
  for (const key of OPTIONAL_KEYS) storage.setItem(key, 'optional data')
  storage.setItem('gul:blog-reader', 'essential data')
  saveConsent('essential')
  assert.equal(optionalAllowed(), false)
  for (const key of OPTIONAL_KEYS) assert.equal(storage.getItem(key), null)
  assert.equal(storage.getItem('gul:blog-reader'), 'essential data')
})

test('a blocked storage write never grants consent', () => {
  storage.removeItem(CONSENT_KEY)
  const original = storage.setItem
  storage.setItem = () => { throw new Error('denied') }
  try {
    saveConsent('all')
    assert.equal(optionalAllowed(), false)
  } finally {
    storage.setItem = original
  }
})
