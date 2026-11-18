import { createHmac } from "node:crypto"
import { POST } from "../[attempt_id]/[transaction_id]/route"

const secret = "callback-tests-only-32-character-secret"
const attempt = { id: "ndp_test", session_id: "payses_test", cart_id: "cart_test", amount_minor: 1000, currency_code: "ils", transaction_id: "900", paid_at: null, canceled_at: null }

describe("Nedarim callback endpoint", () => {
  const env = { ...process.env }
  beforeEach(() => Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "test", NEDARIM_WEBHOOK_SECRET: secret, NEDARIM_CALLBACK_BASE_URL: "https://backend.example" }))
  afterEach(() => { process.env = { ...env } })

  function request(change: Record<string, unknown> = {}, signed = true, duplicateTransactionId = false) {
    const data = { Status: "OK", ID: "1000", Param2: attempt.id, TransactionId: "900", MosadNumber: "1234567", Amount: "10.00", Currency: "1", Confirmation: "123456", ...change }
    const rawBody = Buffer.from(duplicateTransactionId
      ? `{"TransactionId":"900",${JSON.stringify({ ...data, TransactionId: data.ID }).slice(1)}`
      : JSON.stringify(data))
    const ts = Math.floor(Date.now() / 1000).toString()
    const ledger = { retrieveNedarimAttempt: jest.fn().mockResolvedValue(attempt), recordPayment: jest.fn().mockResolvedValue(undefined) }
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }
    const req = { rawBody, body: { ...data, Amount: "forged parsed body" }, ip: "18.196.146.117",
      headers: signed ? { "x-nedarim-timestamp": ts, "x-nedarim-signature": `v1=${createHmac("sha256", secret).update(ts + ".").update(rawBody).digest("hex")}` } : {},
      params: { attempt_id: attempt.id, transaction_id: "900" }, scope: { resolve: (name: string) => name === "logger" ? logger : ledger } }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    return { req, res, ledger }
  }

  it("rejects unsigned browser requests before even looking up the payment attempt", async () => {
    const { req, res, ledger } = request({}, false)
    await POST(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(ledger.retrieveNedarimAttempt).not.toHaveBeenCalled()
  })
  it("validates and records the signed raw body before acknowledging", async () => {
    const { req, res, ledger } = request()
    await POST(req as any, res as any)
    expect(ledger.recordPayment).toHaveBeenCalledWith(attempt.id, "1000", "Card")
    expect(ledger.recordPayment.mock.invocationCallOrder[0]).toBeLessThan(res.json.mock.invocationCallOrder[0])
    expect(res.status).not.toHaveBeenCalled()
  })
  it("records a live provider callback containing both preparation and history TransactionId members", async () => {
    const { req, res, ledger } = request({}, true, true)
    await POST(req as any, res as any)
    expect(ledger.recordPayment).toHaveBeenCalledWith(attempt.id, "1000", "Card")
    expect(res.status).not.toHaveBeenCalled()
  })
  it("does not acknowledge storage failures, preserving recovery through history", async () => {
    const { req, res, ledger } = request()
    ledger.recordPayment.mockRejectedValue(new Error("database unavailable"))
    await expect(POST(req as any, res as any)).rejects.toThrow()
    expect(res.json).not.toHaveBeenCalled()
  })
  it("accepts a retryable provider failure without recording a payment", async () => {
    const { req, res, ledger } = request({ Status: "Error", BackMessage: "NEED CAPTCHA", ID: "" })
    await POST(req as any, res as any)
    expect(ledger.recordPayment).not.toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
  it("rejects a signed but unrelated or underpaid transaction", async () => {
    for (const change of [{ Amount: "1" }, { Param2: "other" }, { MosadNumber: "7654321" }, { TransactionId: "901" }]) {
      const { req, res, ledger } = request(change)
      await POST(req as any, res as any)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(ledger.recordPayment).not.toHaveBeenCalled()
    }
  })
})
