export type InstallmentPolicy = { enabled: boolean; amount_per_installment: number; max_installments: number }

// Display-only mirror of the backend rule (apps/backend/src/lib/nedarim-installments.ts).
// The payment route enforces the rule again against the server-locked amount.
export function maxInstallments(total: number | null | undefined, currency: string | null | undefined, policy: InstallmentPolicy | null | undefined) {
  if (!policy?.enabled || (currency || "").toLowerCase() !== "ils") return 1
  const minor = Math.round(Number(total) * 100)
  const perInstallment = Math.round(Number(policy.amount_per_installment) * 100)
  if (!Number.isSafeInteger(minor) || minor <= 0 || !(perInstallment > 0)) return 1
  return Math.max(1, Math.min(Number(policy.max_installments) || 1, 36, Math.floor(minor / perInstallment)))
}

// Equal installments, with any remaining agorot added to the first one (as the server plans).
// After payment, the confirmation shows the split Nedarim actually reported.
export function installmentPlan(total: number | null | undefined, count: number) {
  const minor = Math.round(Number(total) * 100)
  const next = Math.floor(minor / count)
  return { count, first: (minor - next * (count - 1)) / 100, next: next / 100 }
}

export function installmentLabel(plan: { count: number; first?: number; next?: number }, format: (amount: number) => string) {
  if (plan.count < 2) return "תשלום אחד"
  if (!plan.first || !plan.next) return `${plan.count} תשלומים`
  return plan.first === plan.next
    ? `${plan.count} תשלומים של ${format(plan.next)}`
    : `${plan.count} תשלומים: הראשון ${format(plan.first)}, והשאר ${format(plan.next)} כל אחד`
}
