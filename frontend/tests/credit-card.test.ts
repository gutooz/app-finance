import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CREDIT_CARD_CATEGORY_VALUE,
  getPaymentMethodLabel,
  getPaymentMethodOptions,
  getCreditCardDueDate,
  isCreditCardCategory,
} from '../src/utils/creditCard.ts'

describe('credit card helpers', () => {
  it('recognizes the system credit card category', () => {
    assert.equal(CREDIT_CARD_CATEGORY_VALUE, 'cartao-de-credito')
    assert.equal(isCreditCardCategory('cartao-de-credito'), true)
    assert.equal(isCreditCardCategory('mercado'), false)
  })

  it('charges credit card purchases on this month due day when it has not passed', () => {
    assert.equal(getCreditCardDueDate('2026-09-04', 10), '2026-09-10')
  })

  it('charges credit card purchases on next month due day after this month due day passed', () => {
    assert.equal(getCreditCardDueDate('2026-09-11', 10), '2026-10-10')
  })

  it('uses the last day of the month when the configured due day does not exist', () => {
    assert.equal(getCreditCardDueDate('2026-02-28', 31), '2026-02-28')
    assert.equal(getCreditCardDueDate('2026-03-31', 31), '2026-03-31')
  })

  it('offers payment methods separately from categories', () => {
    const methods = getPaymentMethodOptions()

    assert.deepEqual(methods.map(method => method.value), ['pix', 'cash', 'debit', 'credit_card'])
    assert.equal(getPaymentMethodLabel('credit_card'), 'Crédito')
    assert.equal(getPaymentMethodLabel('pix'), 'Pix')
  })
})
