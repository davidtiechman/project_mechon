import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

export const NEDARIM_PROVIDER_ID = "pp_nedarim_nedarim"
export const NEDARIM_IFRAME_ORIGIN = "https://www.matara.pro"
export const NEDARIM_METHODS = "Card,GooglePay,ApplePay,Bit,DigitalTransfer"
export const nedarimEnabled = () => process.env.NEDARIM_ENABLED !== "false" && !!process.env.NEDARIM_MOSAD?.trim()

export function nedarimConfig() {
  const mosad = process.env.NEDARIM_MOSAD?.trim()
  const apiValid = process.env.NEDARIM_API_VALID?.trim()
  // STAMP_HMAC is the existing provider signing key confirmed by the site owner.
  const secret = process.env.NEDARIM_WEBHOOK_SECRET?.trim() || process.env.STAMP_HMAC?.trim()
  const backendUrl = process.env.NEDARIM_CALLBACK_BASE_URL || process.env.MEDUSA_BACKEND_URL
  if (!mosad || !/^(0|\d{7})$/.test(mosad) || !apiValid || !secret || secret.length < 32 || !backendUrl) {
    throw new Error("Configure NEDARIM_MOSAD, NEDARIM_API_VALID, NEDARIM_WEBHOOK_SECRET or STAMP_HMAC (32+ characters), and NEDARIM_CALLBACK_BASE_URL or MEDUSA_BACKEND_URL")
  }
  const url = new URL(backendUrl)
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Nedarim callbacks require a public HTTPS base URL")
  }
  return { mosad, apiValid, secret, backendUrl: backendUrl.replace(/\/$/, "") }
}

// Medusa v2 amounts are major currency units. Store and compare integer agorot/cents.
export function minorAmount(value: unknown): number {
  const text = String(value ?? "")
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid payment amount")
  const amount = Number(text) * 100
  const minor = Math.round(amount)
  if (!Number.isSafeInteger(minor) || minor <= 0 || Math.abs(amount - minor) > 0.00001) {
    throw new Error("Invalid payment amount precision")
  }
  return minor
}

export function nedarimCurrency(currency: string): string {
  if (currency.toLowerCase() === "ils") return "1"
  if (currency.toLowerCase() === "usd") return "2"
  throw new Error("Nedarim supports ILS and USD only")
}

export function verifyNedarimSignature(rawBody: Buffer | string | undefined, headers: Record<string, unknown>, secrets: string[], now = Date.now()) {
  const timestamp = headers["x-nedarim-timestamp"]
  const signature = headers["x-nedarim-signature"]
  if (rawBody === undefined || typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) ||
      typeof signature !== "string" || !/^v1=[a-f0-9]{64}$/.test(signature) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const actual = new Uint8Array(Buffer.from(signature.slice(3), "hex"))
  return secrets.filter(Boolean).some((secret) => {
    const expected = createHmac("sha256", secret).update(timestamp + ".").update(rawBody).digest()
    return timingSafeEqual(new Uint8Array(expected), actual)
  })
}

export function providerText(value: unknown, max: number) {
  return String(value ?? "").replace(/[<>]/g, "").replace(/&#/g, "").slice(0, max)
}

export async function createNedarimTransaction(attempt: { id: string; amount_minor: number; currency_code: string }, cart: Record<string, any>) {
  const config = nedarimConfig()
  const address = cart.billing_address || cart.shipping_address || {}
  const form = new URLSearchParams({
    Mosad: config.mosad, ApiValid: config.apiValid, PaymentType: "Ragil",
    Amount: (attempt.amount_minor / 100).toFixed(2), Currency: nedarimCurrency(attempt.currency_code),
    Tashlumim: "1", Param2: attempt.id,
    // Param2 is not stored in history. This exact, server-generated comment enables recovery.
    Comment: `Mechon ${attempt.id}`,
    FirstName: providerText(address.first_name, 50), LastName: providerText(address.last_name, 50),
    Street: providerText([address.address_1, address.address_2].filter(Boolean).join(" "), 100),
    City: providerText(address.city, 100), Mail: providerText(cart.email, 50),
    Phone: String(address.phone || cart.shipping_address?.phone || "").replace(/\D/g, "").slice(0, 20),
    CallBack: `${config.backendUrl}/hooks/nedarim/${attempt.id}/[ID]`,
    // Creation never charges a card. After an uncertain timeout a fresh request may
    // safely create an unreachable orphan, rather than reusing a permanently blocked AjaxId.
    AjaxId: randomUUID(),
  })
  const response = await fetch("https://matara.pro/nedarimplus/V6/Files/WebServices/DebitIframe.aspx?Action=CreateTransaction", {
    method: "POST", body: form, signal: AbortSignal.timeout(12_000), redirect: "error",
  })
  if (!response.ok) throw new Error("Nedarim transaction creation failed")
  let data: Record<string, unknown>
  try { data = await response.json() } catch { throw new Error("Invalid Nedarim response") }
  if (data.Status !== "OK" || !/^\d+$/.test(String(data.ID)) || typeof data.Key !== "string" || !data.Key) {
    // Do not expose upstream request/response data or credentials in errors.
    throw new Error("לא ניתן לפתוח את התשלום בנדרים פלוס. יש לבדוק את הגדרות המוסד ופרטי החיוב.")
  }
  return { transaction_id: String(data.ID), transaction_key: data.Key }
}

export type NedarimAttempt = {
  id: string; session_id: string; cart_id: string | null; amount_minor: number; currency_code: string
  transaction_id: string | null; transaction_key: string | null; payment_id: string | null
  paid_at: Date | null; canceled_at: Date | null; processed_at: Date | null
}

// Call only AFTER verifying the HMAC over the original bytes. The provider's
// live card callback repeats TransactionId: preparation ID, then history ID.
// JSON.parse alone silently loses the preparation ID. Read top-level members
// without changing their bytes and reject every other ambiguous duplicate.
export function parseNedarimCallback(rawBody: Buffer | string, transactionId: string) {
  const raw = rawBody.toString()
  const data = JSON.parse(raw)
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid callback object")
  const members = new Map<string, unknown[]>()
  let depth = 0, key: string | undefined, valueStart = 0
  const finish = (end: number) => {
    if (key === undefined) return
    const values = members.get(key) || []
    values.push(JSON.parse(raw.slice(valueStart, end)))
    members.set(key, values)
    key = undefined
  }
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    if (char === '"') {
      const start = i++
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === "\\") i++
        i++
      }
      if (depth === 1 && key === undefined) {
        key = JSON.parse(raw.slice(start, i + 1))
        let colon = i + 1
        while (/\s/.test(raw[colon])) colon++
        valueStart = colon + 1
      }
    } else if (char === "{" || char === "[") depth++
    else if (char === "}" || char === "]") {
      if (depth === 1) finish(i)
      depth--
    } else if (char === "," && depth === 1) finish(i)
  }
  for (const [name, values] of members) {
    if (values.length <= 1) continue
    if (name !== "TransactionId" || values.length !== 2 ||
        !values.every(value => typeof value === "string" || typeof value === "number") ||
        !values.some(value => String(value) === transactionId) ||
        !values.some(value => String(value) === String(data.ID)) ||
        !values.every(value => [transactionId, String(data.ID)].includes(String(value)))) {
      throw new Error("Ambiguous callback fields")
    }
    data.TransactionId = transactionId
  }
  return data as Record<string, unknown>
}

export function validateNedarimPayment(attempt: NedarimAttempt, data: Record<string, unknown>, mosad: string) {
  if (data.Status !== "OK" || String(data.Param2) !== attempt.id ||
      String(data.MosadNumber) !== mosad || minorAmount(data.Amount) !== Number(attempt.amount_minor) ||
      String(data.Currency) !== nedarimCurrency(attempt.currency_code) ||
      (data.TransactionId != null && String(data.TransactionId) !== attempt.transaction_id) ||
      !/^\d+$/.test(String(data.ID)) || Number(data.ID) <= 0 || data.KevaId || data.NextDate) {
    throw new Error("Nedarim payment does not match the server payment attempt")
  }
  const method = String(data.PaymentMethod || "Card")
  const digital = ["Bit", "DigitalTransfer"].includes(method) || ["27", "28", "29", "30"].includes(String(data.Solek))
  if (!digital && !String(data.Confirmation || "").trim()) throw new Error("Unconfirmed Nedarim card transaction")
  if (data.Tashloumim != null && String(data.Tashloumim) !== "1") throw new Error("Unexpected installment count")
  return { paymentId: String(data.ID), method }
}

export function validateNedarimHistoryPayment(attempt: NedarimAttempt, row: Record<string, unknown>) {
  const digital = ["27", "28", "29", "30"].includes(String(row.Solek))
  if (!/^\d+$/.test(String(row.TransactionId)) || BigInt(String(row.TransactionId)) <= 0n ||
      row.Comments !== `Mechon ${attempt.id}` || row.KevaId ||
      minorAmount(row.Amount) !== Number(attempt.amount_minor) ||
      String(row.Currency) !== nedarimCurrency(attempt.currency_code) ||
      (!digital && !String(row.Confirmation || "").trim()) ||
      (row.Tashloumim != null && String(row.Tashloumim) !== "1")) {
    throw new Error("History payment does not match the server payment attempt")
  }
  return { paymentId: String(row.TransactionId), method: digital ? (String(row.Solek) === "30" ? "DigitalTransfer" : "Bit") : "Card" }
}

export async function retrieveNedarimHistoryPayment(attempt: NedarimAttempt, paymentId: string) {
  const password = process.env.NEDARIM_API_PASSWORD?.trim()
  if (!password || !/^\d+$/.test(paymentId) || BigInt(paymentId) <= 0n) throw new Error("A history API key and positive payment ID are required")
  const { mosad } = nedarimConfig()
  const params = new URLSearchParams({ Action: "GetHistoryJson", MosadId: mosad, ApiPassword: password,
    LastId: (BigInt(paymentId) - 1n).toString(), MaxId: "1" })
  let response: Response
  try {
    response = await fetch(`https://matara.pro/nedarimplus/Reports/Manage3.aspx?${params}`, {
      signal: AbortSignal.timeout(12_000), redirect: "error",
    })
  } catch { throw new Error("Nedarim history request failed") }
  if (!response.ok) throw new Error("Nedarim history is unavailable")
  let rows: unknown
  try { rows = await response.json() } catch { throw new Error("Invalid Nedarim history response") }
  if (!Array.isArray(rows) || rows.length !== 1 || String(rows[0]?.TransactionId) !== paymentId) {
    throw new Error("The requested payment was not returned by authenticated Nedarim history; check the key and its permissions")
  }
  return validateNedarimHistoryPayment(attempt, rows[0])
}
