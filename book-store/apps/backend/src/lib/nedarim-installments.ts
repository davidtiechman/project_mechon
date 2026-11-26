import { SITE_CONTENT_MODULE } from "../modules/site-content"

// Owner-editable rule, stored as a site setting and edited in Admin > Site content > Installments.
export const INSTALLMENTS_SETTING_KEY = "nedarim_installments"
// Provider limits: at most 36 installments (NedarimPlus-API). The API documents at least
// 5 ₪ per installment, but Nedarim support (2026-11-26) states at least 10 ₪ per installment
// on its payment pages, so the stricter limit applies.
export const NEDARIM_MAX_INSTALLMENTS = 36
export const NEDARIM_MIN_INSTALLMENT_AMOUNT = 10

export type InstallmentPolicy = {
  enabled: boolean
  // One installment is allowed for every full amount of this size (₪), e.g. 50.
  amount_per_installment: number
  max_installments: number
}

export const DEFAULT_INSTALLMENT_POLICY: InstallmentPolicy = { enabled: false, amount_per_installment: 50, max_installments: 12 }

/** Strict validation for an owner save. Throws a Hebrew message on invalid input. */
export function validateInstallmentPolicy(input: unknown): InstallmentPolicy {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const amount = Number(value.amount_per_installment)
  const max = Number(value.max_installments)
  if (typeof value.enabled !== "boolean") throw new Error("יש לבחור אם התשלומים פעילים.")
  if (!Number.isFinite(amount) || amount < NEDARIM_MIN_INSTALLMENT_AMOUNT || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
    throw new Error(`הסכום לכל תשלום חייב להיות לפחות ${NEDARIM_MIN_INSTALLMENT_AMOUNT} ₪, עד שתי ספרות אחרי הנקודה.`)
  }
  if (!Number.isInteger(max) || max < 2 || max > NEDARIM_MAX_INSTALLMENTS) {
    throw new Error(`המספר המרבי של תשלומים חייב להיות בין 2 ל־${NEDARIM_MAX_INSTALLMENTS}.`)
  }
  return { enabled: value.enabled, amount_per_installment: Math.round(amount * 100) / 100, max_installments: max }
}

/** Lenient reading of a stored value: anything invalid disables installments. */
export function sanitizeInstallmentPolicy(value: unknown): InstallmentPolicy {
  try { return validateInstallmentPolicy(value) }
  catch { return { ...DEFAULT_INSTALLMENT_POLICY, enabled: false } }
}

/** The most installments an order may be split into. 1 means a single payment only. */
export function maxInstallments(amountMinor: number, currency: string, policy: InstallmentPolicy) {
  // The rule is defined in shekels; Nedarim installments are offered for ILS orders only.
  if (!policy.enabled || currency.toLowerCase() !== "ils" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 1
  const perInstallmentMinor = Math.round(policy.amount_per_installment * 100)
  return Math.max(1, Math.min(policy.max_installments, NEDARIM_MAX_INSTALLMENTS, Math.floor(amountMinor / perInstallmentMinor)))
}

// Equal installments, with any remaining agorot added to the first one. Shown before
// paying; after payment the confirmation shows the split Nedarim actually reported.
export function planInstallments(amountMinor: number, count: number) {
  const next = Math.floor(amountMinor / count)
  return { count, first: (amountMinor - next * (count - 1)) / 100, next: next / 100 }
}

type Scope = { resolve(name: string): any }

export async function loadInstallmentPolicy(scope: Scope): Promise<InstallmentPolicy> {
  const service = scope.resolve(SITE_CONTENT_MODULE)
  const [setting] = await service.listSiteSettings({ key: INSTALLMENTS_SETTING_KEY }, { take: 1 })
  return sanitizeInstallmentPolicy(setting?.value)
}

export async function saveInstallmentPolicy(scope: Scope, input: unknown): Promise<InstallmentPolicy> {
  const policy = validateInstallmentPolicy(input)
  const service = scope.resolve(SITE_CONTENT_MODULE)
  const [setting] = await service.listSiteSettings({ key: INSTALLMENTS_SETTING_KEY }, { take: 1 })
  if (setting) await service.updateSiteSettings({ id: setting.id, value: policy })
  else await service.createSiteSettings({ key: INSTALLMENTS_SETTING_KEY, value: policy })
  return policy
}
