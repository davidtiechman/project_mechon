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

// Methods offered for a single payment besides a credit card. The owner turns a method on
// once it is active at Nedarim (bit / bank transfer) or the domain is approved (Apple Pay).
// The same list drives the Nedarim window and the checkout text, so they always match.
export const PAYMENT_METHODS_SETTING_KEY = "nedarim_payment_methods"
export type WalletSettings = { google_pay: boolean; apple_pay: boolean; bit: boolean; digital_transfer: boolean }
export const DEFAULT_WALLETS: WalletSettings = { google_pay: true, apple_pay: false, bit: false, digital_transfer: false }
const WALLET_METHODS: Array<[keyof WalletSettings, string]> = [
  ["google_pay", "GooglePay"], ["apple_pay", "ApplePay"], ["bit", "Bit"], ["digital_transfer", "DigitalTransfer"],
]

export function validateWallets(input: unknown): WalletSettings {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  for (const [key] of WALLET_METHODS) {
    if (typeof value[key] !== "boolean") throw new Error("יש לבחור לכל אמצעי תשלום אם הוא פעיל.")
  }
  return Object.fromEntries(WALLET_METHODS.map(([key]) => [key, value[key] === true])) as WalletSettings
}

export function sanitizeWallets(value: unknown): WalletSettings {
  try { return validateWallets(value) } catch { return { ...DEFAULT_WALLETS } }
}

/** The Nedarim "Methods" list: installments are card-only (bit and transfer allow one payment). */
export function nedarimMethods(wallets: WalletSettings, installments: number) {
  if (installments > 1) return "Card"
  return ["Card", ...WALLET_METHODS.filter(([key]) => wallets[key]).map(([, method]) => method)].join(",")
}

type Scope = { resolve(name: string): any }

export async function loadInstallmentPolicy(scope: Scope): Promise<InstallmentPolicy> {
  const service = scope.resolve(SITE_CONTENT_MODULE)
  const [setting] = await service.listSiteSettings({ key: INSTALLMENTS_SETTING_KEY }, { take: 1 })
  return sanitizeInstallmentPolicy(setting?.value)
}

async function saveSetting(scope: Scope, key: string, value: unknown) {
  const service = scope.resolve(SITE_CONTENT_MODULE)
  const [setting] = await service.listSiteSettings({ key }, { take: 1 })
  if (setting) await service.updateSiteSettings({ id: setting.id, value })
  else await service.createSiteSettings({ key, value })
}

export async function saveInstallmentPolicy(scope: Scope, input: unknown): Promise<InstallmentPolicy> {
  const policy = validateInstallmentPolicy(input)
  await saveSetting(scope, INSTALLMENTS_SETTING_KEY, policy)
  return policy
}

export async function loadWallets(scope: Scope): Promise<WalletSettings> {
  const service = scope.resolve(SITE_CONTENT_MODULE)
  const [setting] = await service.listSiteSettings({ key: PAYMENT_METHODS_SETTING_KEY }, { take: 1 })
  return sanitizeWallets(setting?.value)
}

/** Validates both parts before saving either, so an invalid form changes nothing. */
export async function savePaymentOptions(scope: Scope, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const policy = validateInstallmentPolicy(body)
  const wallets = body.wallets === undefined ? undefined : validateWallets(body.wallets)
  await saveSetting(scope, INSTALLMENTS_SETTING_KEY, policy)
  if (wallets) await saveSetting(scope, PAYMENT_METHODS_SETTING_KEY, wallets)
  return { policy, wallets: wallets ?? await loadWallets(scope) }
}
