import { checkNedarimTransaction, NedarimAttempt } from "../nedarim"
import { NEDARIM_CHECK_INTERVAL_MS, NEDARIM_HISTORY_RETRY_MS, resetNedarimVerificationCache, verifyWithNedarim } from "../nedarim-verify"

const attempt: NedarimAttempt = {
  id: "ndp_" + "b".repeat(32), session_id: "payses_test", cart_id: "cart_test", amount_minor: 12345,
  currency_code: "ils", transaction_id: "2022535", transaction_key: "testkey", payment_id: null,
  paid_at: null, canceled_at: null, processed_at: null,
}
const history = { TransactionId: "83315297", Comments: `Mechon ${attempt.id}`, Amount: "123.45", Currency: "1",
  Confirmation: "123456", Solek: "1", Tashloumim: "1" }
const json = (body: unknown) => ({ ok: true, json: async () => body })
const status = (body: unknown) => json(body)

describe("Nedarim CheckTransaction status lookup", () => {
  const env = { ...process.env }, originalFetch = global.fetch
  beforeEach(() => Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "test",
    NEDARIM_WEBHOOK_SECRET: "test-only-shared-secret-32-characters-long", NEDARIM_CALLBACK_BASE_URL: "https://backend.example" }))
  afterEach(() => { process.env = { ...env }; global.fetch = originalFetch })

  it("asks the documented read-only endpoint by the server-created transaction ID", async () => {
    const fetchMock = jest.fn().mockResolvedValue(status({ Status: "OK", Message: "83315297", MosadName: "test" }))
    global.fetch = fetchMock
    expect(await checkNedarimTransaction("2022535")).toEqual({ state: "paid", paymentId: "83315297" })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe("/nedarimplus/V6/Files/WebServices/DebitBit.aspx")
    expect(Object.fromEntries(url.searchParams)).toEqual({ Action: "CheckTransaction", MosadId: "1234567", TransactionId: "2022535" })
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error")
  })
  it.each(["העסקה ממתינה לביצוע", "העסקה לא אושרה"])("reports an unexecuted transaction as not paid: %s", async message => {
    global.fetch = jest.fn().mockResolvedValue(status({ Status: "Error", Message: message }))
    expect(await checkNedarimTransaction("2022535")).toEqual({ state: "not_paid" })
  })
  it.each([
    { Status: "OK", Message: "" }, { Status: "OK", Message: "0" }, { Status: "OK", Message: "abc" },
    { Status: "Error", Message: "פרמטר Action לא תקין" }, { Status: "Error", Message: "שגיאה כללית" }, null, [],
  ])("never interprets an unrecognized answer as success or failure", async body => {
    global.fetch = jest.fn().mockResolvedValue(status(body))
    await expect(checkNedarimTransaction("2022535")).rejects.toThrow()
  })
  it("treats network and HTTP failures as unknown, and rejects a non-numeric ID without a request", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"))
    await expect(checkNedarimTransaction("2022535")).rejects.toThrow()
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    await expect(checkNedarimTransaction("2022535")).rejects.toThrow()
    global.fetch = jest.fn()
    await expect(checkNedarimTransaction("1&Action=Other")).rejects.toThrow()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe("server-side payment verification with Nedarim", () => {
  const env = { ...process.env }, originalFetch = global.fetch
  let ledger: { recordPayment: jest.Mock }
  let logger: { error: jest.Mock }
  const now = 1_800_000_000_000
  beforeEach(() => {
    resetNedarimVerificationCache()
    Object.assign(process.env, { NEDARIM_MOSAD: "1234567", NEDARIM_API_VALID: "test",
      NEDARIM_WEBHOOK_SECRET: "test-only-shared-secret-32-characters-long", NEDARIM_CALLBACK_BASE_URL: "https://backend.example",
      NEDARIM_API_PASSWORD: "npk_test_read_only" })
    ledger = { recordPayment: jest.fn() }
    logger = { error: jest.fn() }
  })
  afterEach(() => { process.env = { ...env }; global.fetch = originalFetch })

  it("records a payment only after the provider status AND authenticated history both match", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(status({ Status: "OK", Message: "83315297" }))
      .mockResolvedValueOnce(json([history]))
    global.fetch = fetchMock
    expect(await verifyWithNedarim(attempt, ledger, logger, now)).toBe("paid")
    expect(ledger.recordPayment).toHaveBeenCalledWith(attempt.id, "83315297", "Card")
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("Action")).toBe("GetHistoryJson")
  })
  it("does not record a provider 'OK' whose history row has another amount, comment or currency", async () => {
    for (const row of [{ ...history, Amount: "1" }, { ...history, Comments: "Mechon other" }, { ...history, Currency: "2" }]) {
      resetNedarimVerificationCache()
      global.fetch = jest.fn()
        .mockResolvedValueOnce(status({ Status: "OK", Message: "83315297" }))
        .mockResolvedValueOnce(json([row]))
      expect(await verifyWithNedarim(attempt, ledger, logger, now)).toBe("unknown")
    }
    expect(ledger.recordPayment).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })
  it("reports not paid without touching history or the ledger", async () => {
    const fetchMock = jest.fn().mockResolvedValue(status({ Status: "Error", Message: "העסקה ממתינה לביצוע" }))
    global.fetch = fetchMock
    expect(await verifyWithNedarim(attempt, ledger, logger, now)).toBe("not_paid")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ledger.recordPayment).not.toHaveBeenCalled()
  })
  it("returns unknown, never not paid, when Nedarim cannot answer", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"))
    expect(await verifyWithNedarim(attempt, ledger, logger, now)).toBe("unknown")
  })
  it("needs no provider call for an already recorded payment or a never-opened attempt", async () => {
    global.fetch = jest.fn()
    expect(await verifyWithNedarim({ ...attempt, paid_at: new Date(), payment_id: "1" }, ledger, logger, now)).toBe("paid")
    expect(await verifyWithNedarim({ ...attempt, transaction_id: null }, ledger, logger, now)).toBe("not_paid")
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it("rate limits provider lookups per attempt and shares concurrent lookups", async () => {
    const fetchMock = jest.fn().mockResolvedValue(status({ Status: "Error", Message: "העסקה ממתינה לביצוע" }))
    global.fetch = fetchMock
    await Promise.all([verifyWithNedarim(attempt, ledger, logger, now), verifyWithNedarim(attempt, ledger, logger, now)])
    await verifyWithNedarim(attempt, ledger, logger, now + NEDARIM_CHECK_INTERVAL_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await verifyWithNedarim(attempt, ledger, logger, now + NEDARIM_CHECK_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it("protects the shared history budget after a failed history verification", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(status({ Status: "OK", Message: "83315297" }))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    global.fetch = fetchMock
    expect(await verifyWithNedarim(attempt, ledger, logger, now)).toBe("unknown")
    expect(await verifyWithNedarim(attempt, ledger, logger, now + NEDARIM_HISTORY_RETRY_MS - 1)).toBe("unknown")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
