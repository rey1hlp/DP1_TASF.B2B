import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDateTime, formatElapsedReal, formatSimSpan } from '../src/utils/time.ts'

test('formatDateTime uses Spanish abbreviated month and 24h time for UTC numeric timestamps', () => {
  const timestamp = Date.UTC(2026, 4, 17, 1, 8)

  assert.equal(formatDateTime(timestamp), '17 may 2026, 01:08')
})

test('formatSimSpan handles zero minutes', () => {
  assert.equal(formatSimSpan(0), '0 min')
})

test('formatSimSpan handles spans below one hour', () => {
  assert.equal(formatSimSpan(45), '45 min')
})

test('formatSimSpan handles exactly one day', () => {
  assert.equal(formatSimSpan(1440), '1 d')
})

test('formatSimSpan handles multiple days with remaining hours', () => {
  assert.equal(formatSimSpan(2940), '2 d 1 h')
})

test('formatElapsedReal handles early seconds precisely', () => {
  assert.equal(formatElapsedReal(75), '1 min 15 s')
})

test('formatElapsedReal handles one hour exactly', () => {
  assert.equal(formatElapsedReal(3600), '1 h')
})

test('formatElapsedReal handles hours and minutes', () => {
  assert.equal(formatElapsedReal(7380), '2 h 3 min')
})
