export type CategoryCostType = 'fixed' | 'variable'

export function normalizeCategoryCostType(value: unknown): CategoryCostType {
  return value === 'fixed' ? 'fixed' : 'variable'
}

export function getCategoryCostTypeLabel(value: CategoryCostType) {
  return value === 'fixed' ? 'Fixo' : 'Variável'
}

export function normalizeCategoryDueDay(value: unknown) {
  const day = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? ''), 10)

  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null
}

export function getCategoryDueDayLabel(value: number | null | undefined) {
  const day = normalizeCategoryDueDay(value)
  return day ? `Dia ${day}` : ''
}

export function getCategoryDueDayOptions() {
  return Array.from({ length: 31 }, (_, index) => index + 1)
}
