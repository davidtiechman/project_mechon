"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "./cookies"
import type { InstallmentPolicy } from "@lib/util/installments"

export type NedarimPayment = { TransactionId: string; Key: string; Methods: string; ButtonText: string }
export type NedarimStatus = {
  status: "pending" | "paid" | "installments_changed" | "installments_unavailable"
  payment?: NedarimPayment
  installments?: number
  max_installments?: number
  // A customer-facing reason the payment could not be opened.
  message?: string
  // Present only when the server asked Nedarim directly (verify). "unknown" is never a failure.
  provider?: "not_paid" | "unknown"
}

async function request(method: "GET" | "POST", verify = false, installments = 1) {
  const cartId = await getCartId()
  if (!cartId) throw new Error("לא נמצאה עגלת קניות פעילה.")
  try {
    return await sdk.client.fetch<NedarimStatus>(`/store/carts/${cartId}/nedarim`, {
      method, headers: await getAuthHeaders(), cache: "no-store",
      ...(verify ? { query: { verify: "1" } } : {}),
      ...(method === "POST" ? { body: { installments } } : {}),
    })
  } catch {
    throw new Error(method === "POST"
      ? "לא ניתן לפתוח את התשלום כרגע. יש להמתין רגע ולנסות שוב."
      : "לא ניתן לבדוק את אישור התשלום כרגע. אין לבצע תשלום נוסף; אפשר לנסות לבדוק שוב.")
  }
}

// The server validates the count against the owner's rule and locks it into the transaction.
export async function beginNedarimPayment(installments = 1) { return request("POST", false, installments) }

// Display-only copy of the owner's installment rule; null when unavailable.
export async function getInstallmentPolicy(): Promise<InstallmentPolicy | null> {
  try {
    return (await sdk.client.fetch<{ policy: InstallmentPolicy }>("/store/site-content/installments", {
      method: "GET", cache: "no-store",
    })).policy
  } catch { return null }
}
// verify=true asks the server to confirm with Nedarim itself (rate limited server-side).
export async function getNedarimPaymentStatus(verify = false) { return request("GET", verify) }
