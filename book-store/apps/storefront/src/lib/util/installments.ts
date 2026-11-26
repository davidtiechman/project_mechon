export type InstallmentPolicy = { enabled: boolean; amount_per_installment: number; max_installments: number }
// Methods the owner offers for a single payment, besides a credit card (see the backend setting).
export type WalletSettings = { google_pay: boolean; apple_pay: boolean; bit: boolean; digital_transfer: boolean }
export type PaymentOptions = { policy: InstallmentPolicy; wallets: WalletSettings }
export const DEFAULT_WALLETS: WalletSettings = { google_pay: true, apple_pay: false, bit: false, digital_transfer: false }

const WALLET_PHRASES: Array<[keyof WalletSettings, string]> = [
  ["google_pay", "ב־Google Pay"], ["apple_pay", "ב־Apple Pay"], ["bit", "בביט"], ["digital_transfer", "בהעברה בנקאית בקליק"],
]

// "בכרטיס אשראי או ב־Google Pay" / "בכרטיס אשראי, ב־Google Pay או בביט"
export function paymentMethodsText(wallets: WalletSettings | null | undefined) {
  const phrases = ["בכרטיס אשראי", ...WALLET_PHRASES.filter(([key]) => (wallets ?? DEFAULT_WALLETS)[key]).map(([, phrase]) => phrase)]
  return phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(", ")} או ${phrases[phrases.length - 1]}`
}

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
