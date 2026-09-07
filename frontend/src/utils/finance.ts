export function getMonthlyIncomeTotal(declaredIncome: number, incomeEntries: number) {
  return (declaredIncome || 0) + (incomeEntries || 0)
}

export function getMonthlyBalance(monthlyIncome: number, monthlyExpenses: number) {
  return (monthlyIncome || 0) - (monthlyExpenses || 0)
}
