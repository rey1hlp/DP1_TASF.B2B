import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatDateTime,
  formatElapsedReal,
  formatShipmentDepartureTime,
  formatSimDateTimeFromMinute,
  formatSimSpan,
  getDayIndexFromDateString,
  parseShipmentDepartureMinute,
} from '../src/utils/time.ts'

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

test('formatSimDateTimeFromMinute renders absolute simulated minute as date and clock', () => {
  const dayIndex = getDayIndexFromDateString('2026-05-17')
  assert.equal(formatSimDateTimeFromMinute((dayIndex ?? 0) * 1440 + 68), '17 may 2026, 01:08')
})

test('parseShipmentDepartureMinute reads backend Min format', () => {
  const dayIndex = getDayIndexFromDateString('2026-05-17')
  assert.equal(parseShipmentDepartureMinute(`Min ${(dayIndex ?? 0) * 1440 + 68}`), (dayIndex ?? 0) * 1440 + 68)
})

test('formatShipmentDepartureTime renders backend Min format as simulated date time', () => {
  const dayIndex = getDayIndexFromDateString('2026-05-17')
  assert.equal(formatShipmentDepartureTime(`Min ${(dayIndex ?? 0) * 1440 + 68}`), '17 may 2026, 01:08')
})

test('formatShipmentDepartureTime keeps timezone timestamps in UTC', () => {
  assert.equal(formatShipmentDepartureTime('2026-05-17T01:08:00Z'), '17 may 2026, 01:08 UTC')
})

test('formatElapsedReal uses mm:ss min for early seconds', () => {
  assert.equal(formatElapsedReal(9), '00:09 min')
})

test('formatElapsedReal uses mm:ss min for minutes and seconds', () => {
  assert.equal(formatElapsedReal(75), '01:15 min')
})

test('formatElapsedReal keeps total minutes after one hour', () => {
  assert.equal(formatElapsedReal(7380), '123:00 min')
})
