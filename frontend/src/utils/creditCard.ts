export const CREDIT_CARD_CATEGORY_VALUE = 'cartao-de-credito'
export type PaymentMethod = 'pix' | 'cash' | 'debit' | 'credit_card'

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; description: string }> = [
  { value: 'pix', label: 'Pix', description: 'Desconta na hora' },
  { value: 'cash', label: 'Dinheiro', description: 'Desconta na hora' },
  { value: 'debit', label: 'Débito', description: 'Desconta na hora' },
  { value: 'credit_card', label: 'Crédito', description: 'Desconta no vencimento' },
]

const CREDIT_CARD_ALIASES = new Set([
  CREDIT_CARD_CATEGORY_VALUE,
  'cartao',
  'cartao-credito',
  'cartao-de-credito',
  'credito',
])

function normalizeCategoryValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatDateInput(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, '0')
  const dateDay = String(day).padStart(2, '0')
  return `${year}-${month}-${dateDay}`
}

function parseDateInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number.parseInt(match[1], 10)
  const monthIndex = Number.parseInt(match[2], 10) - 1
  const day = Number.parseInt(match[3], 10)
  const parsed = new Date(year, monthIndex, day)

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== monthIndex
    || parsed.getDate() !== day
  ) {
    return null
  }

  return { year, monthIndex, day }
}

export function isCreditCardCategory(value: string | null | undefined) {
  if (!value) return false
  return CREDIT_CARD_ALIASES.has(normalizeCategoryValue(value))
}

export function getPaymentMethodOptions() {
  return PAYMENT_METHODS
}

export function getPaymentMethodLabel(value: PaymentMethod) {
  return PAYMENT_METHODS.find(method => method.value === value)?.label ?? value
}

export function getCreditCardDueDate(purchaseDate: string, dueDay: number) {
  const parsed = parseDateInput(purchaseDate)
  if (!parsed || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return ''

  let dueYear = parsed.year
  let dueMonthIndex = parsed.monthIndex
  if (parsed.day > dueDay) {
    dueMonthIndex += 1
    if (dueMonthIndex > 11) {
      dueMonthIndex = 0
      dueYear += 1
    }
  }

  const lastDay = new Date(dueYear, dueMonthIndex + 1, 0).getDate()
  return formatDateInput(dueYear, dueMonthIndex, Math.min(dueDay, lastDay))
}
