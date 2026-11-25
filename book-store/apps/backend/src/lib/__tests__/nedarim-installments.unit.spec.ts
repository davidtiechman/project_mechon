import { createNedarimTransaction, NedarimAttempt, validateNedarimHistoryPayment, validateNedarimPayment } from "../nedarim"
import { maxInstallments, planInstallments, sanitizeInstallmentPolicy, validateInstallmentPolicy } from "../nedarim-installments"
import { installmentsText } from "../../modules/resend/emails"

const policy = { enabled: true, amount_per_installment: 50, max_installments: 12 }

describe("owner installment rule: one installment per full amount", () => {
  it.each([
    [40, 1], [49.99, 1], [50, 1], [99.99, 1], [100, 2], [149, 2], [150, 3], [260, 5], [600, 12], [1000, 12],
  ])("an order of %d ₪ allows up to %d installments", (total, expected) => {
    expect(maxInstallments(Math.round(total * 100), "ils", policy)).toBe(expected)
  })
  it("every allowed installment is at least the configured amount", () => {
    for (let minor = 100; minor <= 200_000; minor += 137) {
      const count = maxInstallments(minor, "ils", policy)
      if (count > 1) expect(minor / count).toBeGreaterThanOrEqual(5000)
    }
  })
  it("offers a single payment only when disabled, for other currencies, or for invalid amounts", () => {
    expect(maxInstallments(100_000, "ils", { ...policy, enabled: false })).toBe(1)
    expect(maxInstallments(100_000, "usd", policy)).toBe(1)
    expect(maxInstallments(0, "ils", policy)).toBe(1)
    expect(maxInstallments(NaN, "ils", policy)).toBe(1)
  })
  it("never exceeds Nedarim's 36-installment limit", () => {
    expect(maxInstallments(10_000_000, "ils", { enabled: true, amount_per_installment: 5, max_installments: 36 })).toBe(36)
  })
})

describe("owner settings validation", () => {
  it("accepts a valid rule and normalizes the amount", () => {
    expect(validateInstallmentPolicy({ enabled: true, amount_per_installment: "50.1", max_installments: "6" }))
      .toEqual({ enabled: true, amount_per_installment: 50.1, max_installments: 6 })
  })
  it.each([
    { enabled: "yes", amount_per_installment: 50, max_installments: 6 },
    { enabled: true, amount_per_installment: 4.99, max_installments: 6 },
    { enabled: true, amount_per_installment: 50.001, max_installments: 6 },
    { enabled: true, amount_per_installment: 50, max_installments: 1 },
    { enabled: true, amount_per_installment: 50, max_installments: 37 },
    { enabled: true, amount_per_installment: 50, max_installments: 2.5 },
    null, "text",
  ])("rejects an invalid owner rule: %j", input => {
    expect(() => validateInstallmentPolicy(input)).toThrow()
  })
  it("treats a corrupt stored value as disabled", () => {
    expect(sanitizeInstallmentPolicy({ enabled: true, amount_per_installment: 1, max_installments: 99 }).enabled).toBe(false)
    expect(sanitizeInstallmentPolicy(undefined).enabled).toBe(false)
  })
})

describe("installment count locked into the Nedarim transaction", () => {
  const attempt: NedarimAttempt = {
    id: "ndp_" + "c".repeat(32), session_id: "payses_test", cart_id: "cart_test", amount_minor: 15000,
    currency_code: "ils", installments: 3, transaction_id: "900", transaction_key: "testkey", payment_id: null,
    paid_at: null, canceled_at: null, processed_at: null,
  }
  const payment = { Status: "OK", ID: "1000", TransactionId: "900", Param2: attempt.id, MosadNumber: "1234567",
    Amount: "150", Currency: "1", Confirmation: "123456", PaymentMethod: "Card", Tashloumim: "3" }
  const history = { TransactionId: "1000", Comments: `Mechon ${attempt.id}`, Amount: "150", Currency: "1",
    Confirmation: "123456", Solek: "1", Tashloumim: "3" }
  const env = { ...process.env }, originalFetch = global.fetch
  afterEach(() => { process.env = { ...env }; global.fetch = originalFetch })

  it("sends the server-chosen count to Nedarim", async () => {
    Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "api-valid",
      NEDARIM_WEBHOOK_SECRET: "test-only-shared-secret-32-characters-long", NEDARIM_CALLBACK_BASE_URL: "https://backend.example" })
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ Status: "OK", ID: "900", Key: "testkey" }) })
    global.fetch = fetchMock
    await createNedarimTransaction(attempt, { email: "buyer@example.com" })
    expect((fetchMock.mock.calls[0][1].body as URLSearchParams).get("Tashlumim")).toBe("3")
    expect((fetchMock.mock.calls[0][1].body as URLSearchParams).has("MaxPayments")).toBe(false)
  })
  it("accepts a callback and a history row only with exactly the locked count", () => {
    expect(validateNedarimPayment(attempt, payment, "1234567").paymentId).toBe("1000")
    expect(validateNedarimHistoryPayment(attempt, history).paymentId).toBe("1000")
    for (const count of ["1", "2", "4", undefined, ""]) {
      expect(() => validateNedarimPayment(attempt, { ...payment, Tashloumim: count }, "1234567")).toThrow()
      expect(() => validateNedarimHistoryPayment(attempt, { ...history, Tashloumim: count })).toThrow()
    }
  })
  it("keeps accepting single payments with or without a reported count", () => {
    const single = { ...attempt, installments: 1 }
    expect(validateNedarimPayment(single, { ...payment, Tashloumim: undefined }, "1234567").paymentId).toBe("1000")
    expect(validateNedarimPayment(single, { ...payment, Tashloumim: "1" }, "1234567").paymentId).toBe("1000")
    expect(() => validateNedarimPayment(single, { ...payment, Tashloumim: "3" }, "1234567")).toThrow()
  })
})

describe("exact installment amounts", () => {
  it("splits evenly when possible and adds remaining agorot to the first installment", () => {
    expect(planInstallments(18000, 3)).toEqual({ count: 3, first: 60, next: 60 })
    expect(planInstallments(10000, 3)).toEqual({ count: 3, first: 33.34, next: 33.33 })
    expect(planInstallments(25990, 4)).toEqual({ count: 4, first: 64.99, next: 64.97 })
    for (const [minor, count] of [[10000, 3], [25990, 4], [12345, 7], [999999, 12]]) {
      const plan = planInstallments(minor, count)
      expect(Math.round(plan.first * 100) + Math.round(plan.next * 100) * (count - 1)).toBe(minor)
      expect(plan.first).toBeGreaterThanOrEqual(plan.next)
    }
  })
  it("keeps the split Nedarim reported only when it adds up to the paid amount", () => {
    const attempt: NedarimAttempt = {
      id: "ndp_" + "d".repeat(32), session_id: "s", cart_id: "c", amount_minor: 18000, currency_code: "ils", installments: 3,
      transaction_id: "900", transaction_key: "k", payment_id: null, paid_at: null, canceled_at: null, processed_at: null,
    }
    const payment = { Status: "OK", ID: "1000", TransactionId: "900", Param2: attempt.id, MosadNumber: "1234567",
      Amount: "180", Currency: "1", Confirmation: "123456", PaymentMethod: "Card", Tashloumim: "3" }
    expect(validateNedarimPayment(attempt, { ...payment, FirstTashloum: "60", NextTashloum: "60" }, "1234567").split)
      .toEqual({ first_minor: 6000, next_minor: 6000 })
    // Display data only: an inconsistent or missing split never rejects a verified payment.
    expect(validateNedarimPayment(attempt, { ...payment, FirstTashloum: "61", NextTashloum: "60" }, "1234567").split).toBeNull()
    expect(validateNedarimPayment(attempt, payment, "1234567").split).toBeNull()
    expect(validateNedarimPayment({ ...attempt, installments: 1 }, { ...payment, Tashloumim: "1", FirstTashloum: "180", NextTashloum: "0" }, "1234567").split).toBeNull()
  })
  it("describes installments in the order email", () => {
    expect(installmentsText({ currency_code: "ils", installments: { count: 3, first: 60, next: 60 } })).toContain("3 תשלומים של")
    expect(installmentsText({ currency_code: "ils", installments: { count: 3, first: 33.34, next: 33.33 } })).toContain("הראשון")
    expect(installmentsText({ currency_code: "ils", installments: { count: 3 } })).toBe("שולם ב־3 תשלומים בכרטיס אשראי")
    expect(installmentsText({ currency_code: "ils" })).toBeNull()
  })
})
