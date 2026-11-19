"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "./cookies"

export type NedarimPayment = { TransactionId: string; Key: string; Methods: string; ButtonText: string }
export type NedarimStatus = { status: "pending" | "paid"; payment?: NedarimPayment }

async function request(method: "GET" | "POST") {
  const cartId = await getCartId()
  if (!cartId) throw new Error("לא נמצאה עגלת קניות פעילה.")
  try {
    return await sdk.client.fetch<NedarimStatus>(`/store/carts/${cartId}/nedarim`, {
      method, headers: await getAuthHeaders(), cache: "no-store",
    })
  } catch {
    throw new Error(method === "POST"
      ? "לא ניתן לפתוח את התשלום כרגע. יש להמתין רגע ולנסות שוב."
      : "לא ניתן לבדוק את אישור התשלום כרגע. אין לבצע תשלום נוסף; אפשר לנסות לבדוק שוב.")
  }
}

export async function beginNedarimPayment() { return request("POST") }
export async function getNedarimPaymentStatus() { return request("GET") }
