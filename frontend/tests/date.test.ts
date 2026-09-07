import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getDateInputValue } from '../src/utils/date.ts'

describe('date helpers', () => {
  it('formats dates for the transaction date input', () => {
    assert.equal(getDateInputValue(new Date(2026, 8, 5)), '2026-09-05')
  })
})
