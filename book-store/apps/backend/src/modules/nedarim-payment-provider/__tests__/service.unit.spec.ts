import NedarimPaymentProvider from "../service"

describe("Nedarim payment provider trust boundary", () => {
  const attempt = { id: "ndp_test", session_id: "payses_real", amount_minor: 12345, currency_code: "ils", paid_at: null as Date | null, payment_id: null as string | null, canceled_at: null }
  let ledger: Record<string, jest.Mock>
  let provider: NedarimPaymentProvider
  beforeEach(() => {
    ledger = {
      createNedarimAttempts: jest.fn(async (data) => ({ ...data })),
      retrieveNedarimAttempt: jest.fn(async () => ({ ...attempt })),
      updateNedarimAttempts: jest.fn(),
    }
    provider = new NedarimPaymentProvider({ nedarimPayments: ledger }, {})
  })

  it("ignores forged status, amount, session and receipt data from the browser", async () => {
    const result = await provider.initiatePayment({ amount: 123.45, currency_code: "ils", context: { idempotency_key: "payses_real" },
      data: { attempt_id: "forged", session_id: "other", paid: true, status: "captured", amount: 1 } })
    expect(result.status).toBe("pending")
    expect(ledger.createNedarimAttempts).toHaveBeenCalledWith(expect.objectContaining({ session_id: "payses_real", amount_minor: 12345 }))
    expect(result.data.attempt_id).not.toBe("forged")
  })
  it("never authorizes from browser success data or pending callback state", async () => {
    await expect(provider.authorizePayment({ data: { attempt_id: "ndp_test", Status: "OK", paid_at: new Date(), payment_id: "1000" },
      context: { idempotency_key: "payses_real" } })).rejects.toThrow()
  })
  it("requires the actual server session even if the other attempt was paid", async () => {
    ledger.retrieveNedarimAttempt.mockResolvedValue({ ...attempt, paid_at: new Date(), payment_id: "1000" })
    await expect(provider.authorizePayment({ data: { attempt_id: "ndp_test" }, context: { idempotency_key: "payses_other" } })).rejects.toThrow()
    await expect(provider.authorizePayment({ data: { attempt_id: "ndp_test" } })).rejects.toThrow()
  })
  it("authorizes a verified, bound payment as already captured, without another charge", async () => {
    ledger.retrieveNedarimAttempt.mockResolvedValue({ ...attempt, paid_at: new Date(), payment_id: "1000" })
    expect(await provider.authorizePayment({ data: { attempt_id: "ndp_test" }, context: { idempotency_key: "payses_real" } }))
      .toEqual({ status: "captured", data: { attempt_id: "ndp_test", transaction_id: "1000" } })
  })
  describe("replacing an opened transaction after the cart changed", () => {
    const env = { ...process.env }, originalFetch = global.fetch
    const opened = { ...attempt, transaction_id: "2022535" }
    beforeEach(() => {
      Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "test",
        NEDARIM_WEBHOOK_SECRET: "test-only-shared-secret-32-characters-long", NEDARIM_CALLBACK_BASE_URL: "https://backend.example" })
      ledger.retrieveNedarimAttempt.mockResolvedValue({ ...opened })
    })
    afterEach(() => { process.env = { ...env }; global.fetch = originalFetch })
    const change = () => provider.updatePayment({ amount: 200, currency_code: "ils", data: { attempt_id: "ndp_test" } } as any)

    it("refuses to cancel a transaction Nedarim reports as paid, so the late callback can still complete its order", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ Status: "OK", Message: "83315297" }) })
      await expect(change()).rejects.toThrow("התשלום כבר בוצע")
      await expect(provider.deletePayment({ data: { attempt_id: "ndp_test" } } as any)).rejects.toThrow("התשלום כבר בוצע")
      expect(ledger.updateNedarimAttempts).not.toHaveBeenCalled()
    })
    it("replaces an unpaid transaction, and keeps the existing safeguards if Nedarim is unreachable", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ Status: "Error", Message: "העסקה ממתינה לביצוע" }) })
      await change()
      global.fetch = jest.fn().mockRejectedValue(new Error("offline"))
      await change()
      expect(ledger.updateNedarimAttempts).toHaveBeenCalledTimes(2)
      expect(ledger.createNedarimAttempts).toHaveBeenCalledTimes(2)
    })
  })
  it("refuses to report an unperformed refund or cancellation as successful", async () => {
    await expect(provider.refundPayment()).rejects.toThrow()
    await expect(provider.cancelPayment()).rejects.toThrow()
  })
})
