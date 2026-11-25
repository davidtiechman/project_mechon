"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "./cookies"

export type NedarimPayment = { TransactionId: string; Key: string; Methods: string; ButtonText: string }
export type NedarimStatus = {
  status: "pending" | "paid"
  payment?: NedarimPayment
  // Present only when the server asked Nedarim directly (verify). "unknown" is never a failure.
  provider?: "not_paid" | "unknown"
}

async function request(method: "GET" | "POST", verify = false) {
  const cartId = await getCartId()
  if (!cartId) throw new Error("לא נמצאה עגלת קניות פעילה.")
  try {
    return await sdk.client.fetch<NedarimStatus>(`/store/carts/${cartId}/nedarim`, {
      method, headers: await getAuthHeaders(), cache: "no-store",
      ...(verify ? { query: { verify: "1" } } : {}),
    })
  } catch {
    throw new Error(method === "POST"
      ? "לא ניתן לפתוח את התשלום כרגע. יש להמתין רגע ולנסות שוב."
      : "לא ניתן לבדוק את אישור התשלום כרגע. אין לבצע תשלום נוסף; אפשר לנסות לבדוק שוב.")
  }
}

export async function beginNedarimPayment() { return request("POST") }
// verify=true asks the server to confirm with Nedarim itself (rate limited server-side).
export async function getNedarimPaymentStatus(verify = false) { return request("GET", verify) }
