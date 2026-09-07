import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getCalendarDayFromDate,
  getFixedCategoryCalendarItems,
  indexCalendarItemsByDay,
} from '../src/utils/calendar.ts'

describe('calendar helpers', () => {
  it('reads the day from date values returned by the API', () => {
    assert.equal(getCalendarDayFromDate('2026-09-10'), 10)
    assert.equal(getCalendarDayFromDate('2026-09-10T00:00:00'), 10)
    assert.equal(getCalendarDayFromDate(new Date(2026, 8, 10)), 10)
  })

  it('indexes records by their calendar day', () => {
    const indexed = indexCalendarItemsByDay([
      { id: 'a', date: '2026-09-10' },
      { id: 'b', date: '2026-09-10T00:00:00' },
      { id: 'c', date: 'bad-date' },
    ], item => item.date)

    assert.equal(indexed[10].length, 2)
    assert.equal(indexed[0], undefined)
  })

  it('turns fixed expense categories into payable calendar items', () => {
    const items = getFixedCategoryCalendarItems([
      { id: '1', name: 'Aluguel', value: 'aluguel', emoji: '🏠', type: 'expense', cost_type: 'fixed', due_day: 10 },
      { id: '2', name: 'Mercado', value: 'mercado', emoji: '🛒', type: 'expense', cost_type: 'variable', due_day: 12 },
      { id: '3', name: 'Salário', value: 'salario', emoji: '💼', type: 'income', cost_type: 'fixed', due_day: 5 },
    ])

    assert.deepEqual(items, [
      {
        id: 'category-1',
        name: 'Aluguel',
        category: 'aluguel',
        emoji: '🏠',
        due_day: 10,
        source: 'category',
      },
    ])
  })
})
