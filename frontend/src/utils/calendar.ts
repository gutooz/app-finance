import { normalizeCategoryCostType, normalizeCategoryDueDay } from './category.ts'

export interface CalendarCategory {
  id: string
  name: string
  value: string
  emoji: string
  type: 'income' | 'expense'
  cost_type?: 'fixed' | 'variable'
  due_day?: number | null
}

export interface FixedCategoryCalendarItem {
  id: string
  name: string
  category: string
  emoji: string
  due_day: number
  source: 'category'
}

export function getCalendarDayFromDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getDate()
  }

  if (typeof value === 'string') {
    const isoDay = value.match(/^\d{4}-\d{2}-(\d{2})/)
    if (isoDay) return Number.parseInt(isoDay[1], 10)

    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.getDate()
  }

  return null
}

export function indexCalendarItemsByDay<T>(list: T[], getDate: (item: T) => unknown) {
  const map: Record<number, T[]> = {}

  list.forEach(item => {
    const day = getCalendarDayFromDate(getDate(item))
    if (!day) return
    if (!map[day]) map[day] = []
    map[day].push(item)
  })

  return map
}

export function getFixedCategoryCalendarItems(categories: CalendarCategory[]) {
  return categories.flatMap(category => {
    const dueDay = normalizeCategoryDueDay(category.due_day)
    const isFixedExpense = category.type === 'expense' && normalizeCategoryCostType(category.cost_type) === 'fixed'

    if (!isFixedExpense || !dueDay) return []

    return [{
      id: `category-${category.id}`,
      name: category.name,
      category: category.value,
      emoji: category.emoji,
      due_day: dueDay,
      source: 'category' as const,
    }]
  })
}
