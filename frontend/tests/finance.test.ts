import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getMonthlyBalance, getMonthlyIncomeTotal } from '../src/utils/finance.ts'

describe('dashboard finance helpers', () => {
  it('subtracts monthly expenses from the monthly income shown on the dashboard', () => {
    assert.equal(getMonthlyBalance(1000, 323345), -322345)
  })

  it('combines declared monthly income with income entries from the month', () => {
    assert.equal(getMonthlyIncomeTotal(1000, 250), 1250)
  })
})
