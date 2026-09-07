export function onlyMoneyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function getMoneyCents(value: string) {
  const digits = onlyMoneyDigits(value)
  return digits ? Number.parseInt(digits, 10) : 0
}

export function formatCentsToBRL(value: string) {
  const cents = getMoneyCents(value)
  if (!cents) return ''

  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function parseCentsToCurrency(value: string) {
  return getMoneyCents(value) / 100
}
