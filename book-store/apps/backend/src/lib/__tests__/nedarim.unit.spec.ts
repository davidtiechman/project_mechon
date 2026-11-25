import { createHmac } from "node:crypto"
import { createNedarimTransaction, minorAmount, nedarimConfig, NedarimAttempt, parseNedarimCallback, retrieveNedarimHistoryPayment, validateNedarimHistoryPayment, validateNedarimPayment, verifyNedarimSignature } from "../nedarim"
import { assertNedarimCart, validateNedarimCheckout } from "../nedarim-checkout"

const secret = "test-only-shared-secret-32-characters-long"
const now = 1_800_000_000_000
const timestamp = String(now / 1000)
const raw = Buffer.from('{ "Amount": 123.45, "Status": "OK" }')
const signed = (body = raw, ts = timestamp, key = secret) => ({
  "x-nedarim-timestamp": ts,
  "x-nedarim-signature": `v1=${createHmac("sha256", key).update(ts + ".").update(body).digest("hex")}`,
})
const attempt: NedarimAttempt = {
  id: "ndp_" + "a".repeat(32), session_id: "payses_test", cart_id: "cart_test", amount_minor: 12345,
  currency_code: "ils", transaction_id: "900", transaction_key: "testkey", payment_id: null,
  paid_at: null, canceled_at: null, processed_at: null,
}
const payment = { Status: "OK", ID: "1000", TransactionId: "900", Param2: attempt.id,
  MosadNumber: "1234567", Amount: "123.45", Currency: "1", Confirmation: "123456", PaymentMethod: "Card", Tashloumim: "1" }

describe("Nedarim live callback JSON", () => {
  const body = JSON.stringify(payment)
  it("preserves the preparation ID when the provider repeats TransactionId with the history ID", () => {
    const raw = `{ "TransactionId": "900", ${body.slice(1, -1)}, "TransactionId": "1000" }`
    // Exactly two IDs, as received from the live provider (not three).
    const actual = raw.replace(',"TransactionId":"900"', '')
    const parsed = parseNedarimCallback(Buffer.from(actual), attempt.transaction_id!)
    expect(parsed.TransactionId).toBe("900")
    expect(validateNedarimPayment(attempt, parsed, "1234567").paymentId).toBe("1000")
  })
  it("handles different member order, escaped keys, nested values and strings without confusing them with IDs", () => {
    const raw = `{ "Extra": {"TransactionId":"decoy","list":[1,{"Amount":0}]}, "Note":"a \\\"TransactionId\\\": 5", "TransactionId":"1000", ${body.slice(1, -1).replace('"TransactionId"', '"Transaction\\u0049d"')} }`
    expect(validateNedarimPayment(attempt, parseNedarimCallback(raw, "900"), "1234567").paymentId).toBe("1000")
  })
  it.each([
    `{"TransactionId":"901",${body.slice(1)}}`,
    `{"TransactionId":"999",${body.slice(1)}}`,
    `{"TransactionId":"1000","TransactionId":"900",${body.slice(1)}}`,
    `{"Amount":"1",${body.slice(1)}}`,
    `{"Status":"Error",${body.slice(1)}}`,
    `{"Param2":"other",${body.slice(1)}}`,
    `{"ID":"2000",${body.slice(1)}}`,
    `[]`, `null`, `{broken`,
  ])("rejects ambiguous or malformed callback JSON", raw => {
    expect(() => parseNedarimCallback(raw, "900")).toThrow()
  })
})

describe("Nedarim authenticated history recovery", () => {
  const env = { ...process.env }, originalFetch = global.fetch
  const history = { TransactionId: "1000", Comments: `Mechon ${attempt.id}`, Amount: "123.45", Currency: "1", Confirmation: "123456", Solek: "1", Tashloumim: "1" }
  beforeEach(() => Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "test", NEDARIM_WEBHOOK_SECRET: secret,
    NEDARIM_CALLBACK_BASE_URL: "https://backend.example", NEDARIM_API_PASSWORD: "npk_test_read_only" }))
  afterEach(() => { process.env = { ...env }; global.fetch = originalFetch })
  it("reads exactly the requested existing payment and validates its server-generated attempt binding", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [history] })
    global.fetch = fetchMock
    expect(await retrieveNedarimHistoryPayment(attempt, "1000")).toEqual({ paymentId: "1000", method: "Card", split: null })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get("LastId")).toBe("999")
    expect(url.searchParams.get("MaxId")).toBe("1")
    expect(url.searchParams.get("MosadId")).toBe("1234567")
    expect(url.searchParams.get("ApiPassword")).toBe("npk_test_read_only")
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error")
  })
  it.each([
    [], [{ ...history, TransactionId: "1001" }], { Status: "Error" },
    [{ ...history, Amount: "1" }], [{ ...history, Amount: "0" }], [{ ...history, Amount: "-123.45" }],
    [{ ...history, Currency: "2" }], [{ ...history, Comments: "Mechon unrelated" }],
    [{ ...history, Confirmation: "" }], [{ ...history, KevaId: "123" }], [{ ...history, Tashloumim: "2" }],
  ].map(rows => [rows]))("rejects absent, unrelated, refunded or unconfirmed history rows", async rows => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => rows })
    await expect(retrieveNedarimHistoryPayment(attempt, "1000")).rejects.toThrow()
  })
  it("requires a history API key before contacting the provider", async () => {
    process.env.NEDARIM_API_PASSWORD = ""
    global.fetch = jest.fn()
    await expect(retrieveNedarimHistoryPayment(attempt, "1000")).rejects.toThrow()
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it("allows a confirmed digital history row without a card confirmation number", () => {
    expect(validateNedarimHistoryPayment(attempt, { ...history, Solek: "27", Confirmation: "" })).toEqual({ paymentId: "1000", method: "Bit", split: null })
  })
})

describe("Nedarim signing-key configuration", () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "api-valid", NEDARIM_CALLBACK_BASE_URL: "https://actual-backend.example" })
    delete process.env.NEDARIM_WEBHOOK_SECRET
    delete process.env.STAMP_HMAC
  })
  afterEach(() => { process.env = { ...originalEnv } })

  it("authenticates callbacks with the existing STAMP_HMAC key when the dedicated variable is empty", () => {
    process.env.STAMP_HMAC = secret
    process.env.NEDARIM_WEBHOOK_SECRET = "   "
    const config = nedarimConfig()
    expect(verifyNedarimSignature(raw, signed(), [config.secret], now)).toBe(true)
    expect(config.backendUrl).toBe("https://actual-backend.example")
  })

  it("gives the explicit Nedarim key priority when both are configured", () => {
    process.env.NEDARIM_WEBHOOK_SECRET = "different-explicit-key-with-32-characters"
    process.env.STAMP_HMAC = secret
    expect(verifyNedarimSignature(raw, signed(), [nedarimConfig().secret], now)).toBe(false)
  })

  it("still rejects absent or short signing keys", () => {
    expect(() => nedarimConfig()).toThrow()
    process.env.STAMP_HMAC = "short"
    expect(() => nedarimConfig()).toThrow()
  })
})

describe("Nedarim signature authentication", () => {
  it("verifies the raw bytes and rejects reserialization or modification", () => {
    expect(verifyNedarimSignature(raw, signed(), [secret], now)).toBe(true)
    expect(verifyNedarimSignature(JSON.stringify(JSON.parse(raw.toString())), signed(), [secret], now)).toBe(false)
    expect(verifyNedarimSignature(Buffer.from(raw.toString().replace("123.45", "1.00")), signed(), [secret], now)).toBe(false)
  })
  it("rejects absent, malformed, stale, future, duplicate-header and incorrect signatures", () => {
    for (const headers of [{}, signed(raw, String(Number(timestamp) - 301)), signed(raw, String(Number(timestamp) + 301)),
      signed(raw, timestamp, "wrong"), { ...signed(), "x-nedarim-timestamp": "NaN" },
      { ...signed(), "x-nedarim-signature": "v1=abcd" }, { ...signed(), "x-nedarim-timestamp": [timestamp, timestamp] }]) {
      expect(verifyNedarimSignature(raw, headers, [secret], now)).toBe(false)
    }
    expect(verifyNedarimSignature(undefined, signed(), [secret], now)).toBe(false)
  })
  it("supports explicit key rotation without accepting unsigned updates", () => {
    expect(verifyNedarimSignature(raw, signed(), ["replacement-key", secret], now)).toBe(true)
    expect(verifyNedarimSignature(raw, signed(), [], now)).toBe(false)
  })
})

describe("Nedarim payment matching", () => {
  it("accepts confirmed card/wallet payments and signed bit payments", () => {
    expect(validateNedarimPayment(attempt, payment, "1234567").paymentId).toBe("1000")
    for (const method of ["GooglePay", "ApplePay"]) {
      expect(validateNedarimPayment(attempt, { ...payment, PaymentMethod: method }, "1234567").method).toBe(method)
    }
    expect(validateNedarimPayment(attempt, { ...payment, PaymentMethod: "Bit", Confirmation: "" }, "1234567").method).toBe("Bit")
  })
  it.each([
    { Status: "Error" }, { Status: "pending" }, { Amount: "1" }, { Amount: "123.451" },
    { Param2: "another-attempt" }, { MosadNumber: "7654321" }, { Currency: "2" },
    { TransactionId: "901" }, { ID: "" }, { ID: "0" }, { Confirmation: "" },
    { KevaId: "123" }, { Tashloumim: "2" }, { Param2: undefined }, { Amount: undefined },
  ])("rejects an unmatched or unconfirmed provider payment: %j", (change) => {
    expect(() => validateNedarimPayment(attempt, { ...payment, ...change }, "1234567")).toThrow()
  })
  it("uses major currency units without rounding underpayments", () => {
    expect(minorAmount("123.45")).toBe(12345)
    expect(minorAmount(0.1 + 0.2)).toBe(30)
    for (const amount of [0, -1, "NaN", "123.456", Infinity, "1e10"]) expect(() => minorAmount(amount)).toThrow()
  })
  const session = { id: attempt.session_id, status: "pending", provider_id: "pp_nedarim_nedarim", amount: 123.45, currency_code: "ils", data: { attempt_id: attempt.id } }
  const cart = { id: attempt.cart_id, total: 123.45, currency_code: "ils" }
  it("rejects cart/session substitution, changed totals, currencies and canceled attempts", () => {
    expect(() => assertNedarimCart(attempt, cart, session)).not.toThrow()
    expect(() => assertNedarimCart(attempt, { ...cart, id: "other-cart" }, session)).toThrow()
    expect(() => assertNedarimCart(attempt, { ...cart, total: 200 }, session)).toThrow()
    expect(() => assertNedarimCart(attempt, { ...cart, currency_code: "usd" }, session)).toThrow()
    expect(() => assertNedarimCart(attempt, cart, { ...session, id: "other-session" })).toThrow()
    expect(() => assertNedarimCart({ ...attempt, canceled_at: new Date() }, cart, session)).toThrow()
  })
  it("blocks direct cart completion without a server payment, including legacy manual sessions", async () => {
    const originalEnv = { ...process.env }
    try {
      process.env.NEDARIM_MOSAD = "1234567"
      delete process.env.NEDARIM_ENABLED
      const container = { resolve: () => ({ retrieveNedarimAttempt: async () => attempt }) } as any
      const fullCart = { ...cart, payment_collection: { payment_sessions: [session] } }
      await expect(validateNedarimCheckout(fullCart, container)).rejects.toThrow()
      await expect(validateNedarimCheckout({ ...fullCart, payment_collection: { payment_sessions: [{ ...session, provider_id: "pp_system_default" }] } }, container)).rejects.toThrow()
      await expect(validateNedarimCheckout(fullCart, { resolve: () => ({ retrieveNedarimAttempt: async () => ({ ...attempt, paid_at: new Date(), payment_id: "1000" }) }) } as any)).resolves.toBeUndefined()
      process.env.NEDARIM_ENABLED = "false"
      process.env.NODE_ENV = "production"
      await expect(validateNedarimCheckout({ ...fullCart, payment_collection: { payment_sessions: [{ ...session, provider_id: "pp_system_default" }] } }, container)).rejects.toThrow()
    } finally { process.env = originalEnv }
  })
})

describe("Nedarim server transaction creation", () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }
  afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv } })
  it("locks the server amount, uses Param2 for bit and does not pass secrets to the iframe", async () => {
    Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "api-valid", NEDARIM_WEBHOOK_SECRET: secret, NEDARIM_CALLBACK_BASE_URL: "https://backend.example" })
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ Status: "OK", ID: "900", Key: "testkey" }) })
    global.fetch = fetchMock
    expect(await createNedarimTransaction(attempt, { email: "buyer@example.com", billing_address: { first_name: "ישראל", phone: "050-1234567" } }))
      .toEqual({ transaction_id: "900", transaction_key: "testkey" })
    const form = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(form.get("Amount")).toBe("123.45")
    expect(form.get("Param2")).toBe(attempt.id)
    expect(form.has("Param1")).toBe(false)
    expect(form.get("Tashlumim")).toBe("1")
    expect(form.get("CallBack")).toBe(`https://backend.example/hooks/nedarim/${attempt.id}/[ID]`)
    expect(form.get("Phone")).toBe("0501234567")
    expect(form.get("FirstName")).toBe("ישראל")
    expect(form.get("Comment")).toBe(`Mechon ${attempt.id}`)
    expect(form.has("ApiPassword")).toBe(false)
  })
})
