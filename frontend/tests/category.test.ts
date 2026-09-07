import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getCategoryCostTypeLabel,
  getCategoryDueDayLabel,
  getCategoryDueDayOptions,
  normalizeCategoryCostType,
  normalizeCategoryDueDay,
} from '../src/utils/category.ts'

describe('category helpers', () => {
  it('defaults missing category cost type to variable', () => {
    assert.equal(normalizeCategoryCostType(undefined), 'variable')
  })

  it('keeps fixed category cost type when selected', () => {
    assert.equal(normalizeCategoryCostType('fixed'), 'fixed')
  })

  it('shows Portuguese labels for category cost type', () => {
    assert.equal(getCategoryCostTypeLabel('fixed'), 'Fixo')
    assert.equal(getCategoryCostTypeLabel('variable'), 'Variável')
  })

  it('normalizes category due day to the supported month range', () => {
    assert.equal(normalizeCategoryDueDay('10'), 10)
    assert.equal(normalizeCategoryDueDay('0'), null)
    assert.equal(normalizeCategoryDueDay('32'), null)
    assert.equal(normalizeCategoryDueDay(''), null)
  })

  it('shows a short due day label when present', () => {
    assert.equal(getCategoryDueDayLabel(10), 'Dia 10')
    assert.equal(getCategoryDueDayLabel(null), '')
  })

  it('provides calendar day options for fixed categories', () => {
    const days = getCategoryDueDayOptions()

    assert.equal(days.length, 31)
    assert.deepEqual(days.slice(0, 3), [1, 2, 3])
    assert.deepEqual(days.slice(-3), [29, 30, 31])
  })
})
