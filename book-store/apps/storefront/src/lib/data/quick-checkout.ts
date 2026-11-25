"use server"

import { sdk } from "@lib/config"
import { CHECKOUT_CONSENT_ERROR, CHECKOUT_TERMS_VERSION } from "@lib/checkout-consent"
import { MARKETING_CONSENT_VERSION } from "@lib/marketing-consent"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCartId } from "./cookies"
import { initiatePaymentSession, saveCheckoutAddresses, setShippingMethod } from "./cart"
import { acceptCheckoutTerms } from "./checkout-consent"
import { saveCheckoutMarketingConsent } from "./marketing-consent"
import { beginNedarimPayment, getNedarimPaymentStatus } from "./nedarim"

const PROVIDER = "pp_nedarim_nedarim"

// One browser request saves checkout details and opens the server-locked payment.
// Amounts and payment status always come from the backend, never from FormData.
export async function prepareQuickCheckout(formData: FormData, accepted: boolean, marketingAccepted: boolean) {
  if (accepted !== true) throw new Error(CHECKOUT_CONSENT_ERROR)
  const cartId = await getCartId()
  if (!cartId) throw new Error("לא נמצאה עגלת קניות פעילה.")
  const shippingMethodId = String(formData.get("shipping_option_id") || "")
  if (!shippingMethodId) throw new Error("יש לבחור משלוח או איסוף עצמי.")
  const installments = Number(formData.get("installments") || 1)
  if (!Number.isInteger(installments) || installments < 1) throw new Error("מספר התשלומים אינו תקין.")
  const headers = await getAuthHeaders()
  const readCart = async () => (await sdk.client.fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
    method: "GET", headers, cache: "no-store",
    query: { fields: "id,total,currency_code,*payment_collection,*payment_collection.payment_sessions" },
  })).cart
  const active = (cart: HttpTypes.StoreCart) => cart.payment_collection?.payment_sessions?.find(session =>
    session.provider_id === PROVIDER && ["pending", "authorized", "captured", "requires_more"].includes(session.status))

  const original = await readCart()
  if (active(original) && (await getNedarimPaymentStatus()).status === "paid") {
    return { status: "paid" as const }
  }
  const error = await saveCheckoutAddresses(formData)
  if (error) throw new Error(error)
  await setShippingMethod({ cartId, shippingMethodId })
  const cart = await readCart()
  const session = active(cart)
  if (!session || Number(session.amount) !== Number(cart.total) || session.currency_code !== cart.currency_code) {
    await initiatePaymentSession(cart, { provider_id: PROVIDER })
  }
  await acceptCheckoutTerms(true, CHECKOUT_TERMS_VERSION)
  let marketingMessage: string | undefined
  try {
    await saveCheckoutMarketingConsent(marketingAccepted === true, MARKETING_CONSENT_VERSION)
  } catch {
    marketingMessage = "בחירת הדיוור לא נשמרה. אפשר לעדכן אותה בהעדפות הדיוור."
  }
  let payment = await beginNedarimPayment(installments)
  if (payment.status === "installments_changed") {
    // The opened transaction has another installment count. A new payment session opens a
    // new transaction; the server cancels the old one only after Nedarim confirms it is unpaid.
    await initiatePaymentSession(await readCart(), { provider_id: PROVIDER })
    payment = await beginNedarimPayment(installments)
  }
  if (payment.status === "installments_unavailable") {
    const max = Number(payment.max_installments) || 1
    return { ...payment, marketingMessage, message: max > 1
      ? `אפשר לחלק את ההזמנה הזו לעד ${max} תשלומים. יש לבחור מספר קטן יותר.`
      : "ההזמנה הזו אינה ניתנת לחלוקה לתשלומים. יש לבחור תשלום אחד." }
  }
  if (payment.status === "installments_changed") {
    return { ...payment, marketingMessage, message: "לא ניתן לשנות כרגע את מספר התשלומים. יש לרענן את העמוד ולנסות שוב." }
  }
  return { ...payment, marketingMessage }
}
