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
  it("refuses to report an unperformed refund or cancellation as successful", async () => {
    await expect(provider.refundPayment()).rejects.toThrow()
    await expect(provider.cancelPayment()).rejects.toThrow()
  })
})
