import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { minorAmount, nedarimEnabled, NEDARIM_PROVIDER_ID, NedarimAttempt } from "./nedarim"
import NedarimPaymentsService from "../modules/nedarim-payments/service"

export async function loadNedarimCart(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart", filters: { id }, fields: [
      "id", "customer_id", "sales_channel_id", "total", "currency_code", "email", "metadata", "completed_at",
      // Narrowing shipping_methods to id alone makes Medusa's total decoration
      // omit shipping charges. Include amounts, taxes and adjustments in the query.
      "billing_address.*", "shipping_address.*", "shipping_methods.*",
      "shipping_methods.tax_lines.*", "shipping_methods.adjustments.*",
      "payment_collection.id", "payment_collection.amount", "payment_collection.currency_code",
      "payment_collection.payment_sessions.*",
    ],
  })
  const cart = data[0]
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  return cart
}

export function activeNedarimSession(cart: Record<string, any>) {
  return cart.payment_collection?.payment_sessions?.find((s: Record<string, any>) =>
    s.provider_id === NEDARIM_PROVIDER_ID && ["pending", "authorized", "captured", "requires_more"].includes(s.status))
}

export function assertNedarimCart(attempt: NedarimAttempt, cart: Record<string, any>, session: Record<string, any>) {
  if (!session || session.id !== attempt.session_id || session.provider_id !== NEDARIM_PROVIDER_ID ||
      session.data?.attempt_id !== attempt.id || attempt.canceled_at ||
      (attempt.cart_id && cart.id !== attempt.cart_id) ||
      minorAmount(cart.total) !== Number(attempt.amount_minor) ||
      minorAmount(session.amount) !== Number(attempt.amount_minor) ||
      cart.currency_code.toLowerCase() !== attempt.currency_code ||
      session.currency_code.toLowerCase() !== attempt.currency_code) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "פרטי העגלה השתנו. יש לפנות לתמיכה אם כבר בוצע חיוב.")
  }
}

export async function validateNedarimCheckout(cart: Record<string, any>, container: MedusaContainer) {
  if (cart.completed_at || Number(cart.total) === 0) return
  if (!nedarimEnabled()) {
    if (process.env.NODE_ENV === "production" && cart.payment_collection?.payment_sessions?.some((s: Record<string, any>) => s.provider_id === "pp_system_default")) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "לא ניתן להשלים הזמנה בתשלום ידני.")
    }
    return
  }
  const session = activeNedarimSession(cart)
  if (!session || typeof session.data?.attempt_id !== "string") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "יש לבחור תשלום בנדרים פלוס.")
  }
  const ledger: NedarimPaymentsService = container.resolve("nedarimPayments")
  const attempt = await ledger.retrieveNedarimAttempt(session.data.attempt_id)
  assertNedarimCart(attempt, cart, session)
  if (!attempt.paid_at || !attempt.payment_id || attempt.cart_id !== cart.id) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "ממתינים לאישור התשלום בשרת. אין לבצע תשלום נוסף.")
  }
}
