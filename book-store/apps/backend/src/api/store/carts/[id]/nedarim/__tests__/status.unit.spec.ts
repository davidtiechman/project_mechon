jest.mock("../../../../../../lib/nedarim-checkout", () => ({
  loadNedarimCart: jest.fn(async () => ({ id: "cart_test", sales_channel_id: "sc_test" })),
  activeNedarimSession: jest.fn(() => ({ data: { attempt_id: "ndp_test" } })),
  assertNedarimCart: jest.fn(),
}))
jest.mock("../../../../../../lib/nedarim-verify", () => ({ verifyWithNedarim: jest.fn() }))
import { GET } from "../route"
import { verifyWithNedarim } from "../../../../../../lib/nedarim-verify"

describe("payment status polling", () => {
  const env = { ...process.env }
  let attempt: Record<string, unknown>
  const request = (query: Record<string, string> = {}) => {
    const logger = { error: jest.fn() }
    const ledger = { retrieveNedarimAttempt: jest.fn(async () => attempt) }
    return { params: { id: "cart_test" }, query, publishable_key_context: { sales_channel_ids: ["sc_test"] },
      scope: { resolve: (name: string) => name === "logger" ? logger : ledger } }
  }
  const response = () => ({ setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() })
  beforeEach(() => {
    Object.assign(process.env, { NEDARIM_ENABLED: "true", NEDARIM_MOSAD: "1234567" })
    attempt = { id: "ndp_test", transaction_id: "2022535", paid_at: null, payment_id: null }
    jest.mocked(verifyWithNedarim).mockReset()
  })
  afterEach(() => { process.env = { ...env } })

  it("answers ordinary polls from the database without contacting Nedarim", async () => {
    const res = response()
    await GET(request() as any, res as any)
    expect(res.json).toHaveBeenCalledWith({ status: "pending" })
    expect(verifyWithNedarim).not.toHaveBeenCalled()
  })
  it("reports paid once the server has a recorded payment", async () => {
    attempt = { ...attempt, paid_at: new Date(), payment_id: "83315297" }
    const res = response()
    await GET(request({ verify: "1" }) as any, res as any)
    expect(res.json).toHaveBeenCalledWith({ status: "paid" })
    expect(verifyWithNedarim).not.toHaveBeenCalled()
  })
  it.each([["paid", { status: "paid" }], ["not_paid", { status: "pending", provider: "not_paid" }],
    ["unknown", { status: "pending", provider: "unknown" }]])("returns the server-side verdict %s", async (verdict, body) => {
    jest.mocked(verifyWithNedarim).mockResolvedValue(verdict as any)
    const res = response()
    await GET(request({ verify: "1" }) as any, res as any)
    expect(res.json).toHaveBeenCalledWith(body)
  })
  it("turns a verification failure into unknown rather than a failed payment", async () => {
    jest.mocked(verifyWithNedarim).mockRejectedValue(new Error("Conflicting Nedarim payment"))
    const res = response()
    await GET(request({ verify: "1" }) as any, res as any)
    expect(res.json).toHaveBeenCalledWith({ status: "pending", provider: "unknown" })
  })
})
