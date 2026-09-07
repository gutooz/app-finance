import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatCentsToBRL, parseCentsToCurrency } from '../src/utils/money.ts'

describe('money input helpers', () => {
  it('formats typed digits as a BRL money mask', () => {
    assert.equal(formatCentsToBRL('323345'), '3.233,45')
    assert.equal(formatCentsToBRL('1'), '0,01')
    assert.equal(formatCentsToBRL(''), '')
  })

  it('parses digit-only cents back to a number for API payloads', () => {
    assert.equal(parseCentsToCurrency('323345'), 3233.45)
    assert.equal(parseCentsToCurrency('001'), 0.01)
    assert.equal(parseCentsToCurrency(''), 0)
  })
})
