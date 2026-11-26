jest.mock("../../../../../../lib/nedarim-checkout", () => ({
  loadNedarimCart: jest.fn(),
  activeNedarimSession: jest.fn(() => ({ data: { attempt_id: "ndp_test" } })),
  assertNedarimCart: jest.fn(),
}))
jest.mock("../../../../../../lib/checkout-consent", () => ({ validateCheckoutConsent: jest.fn() }))
jest.mock("../../../../../../lib/nedarim-installments", () => ({
  ...jest.requireActual("../../../../../../lib/nedarim-installments"),
  loadInstallmentPolicy: jest.fn(async () => ({ enabled: true, amount_per_installment: 50, max_installments: 12 })),
  loadWallets: jest.fn(async () => ({ google_pay: true, apple_pay: false, bit: true, digital_transfer: false })),
}))
jest.mock("../../../../../../lib/nedarim", () => ({
  ...jest.requireActual("../../../../../../lib/nedarim"),
  createNedarimTransaction: jest.fn(async () => ({ transaction_id: "900", transaction_key: "key" })),
}))
import { POST } from "../route"
import { loadNedarimCart } from "../../../../../../lib/nedarim-checkout"
import { createNedarimTransaction } from "../../../../../../lib/nedarim"

describe("choosing installments when opening a payment", () => {
  const env = { ...process.env }
  let attempt: Record<string, any>, ledger: Record<string, jest.Mock>
  const cart = { id: "cart_test", sales_channel_id: "sc", email: "a@b.c", shipping_address: {}, billing_address: {}, shipping_methods: [{}], metadata: {} }
  const call = async (body: unknown) => {
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    const scope = { resolve: (name: string) => name === "nedarimPayments" ? ledger : { projectConfig: { http: { jwtSecret: "x" } } } }
    await POST({ params: { id: "cart_test" }, body, publishable_key_context: { sales_channel_ids: ["sc"] }, scope } as any, res as any)
    return res
  }
  beforeEach(() => {
    Object.assign(process.env, { NEDARIM_ENABLED: "true", NEDARIM_MOSAD: "1234567" })
    delete process.env.NEDARIM_ACCEPT_NEW_PAYMENTS
    attempt = { id: "ndp_test", amount_minor: 15000, currency_code: "ils", installments: 1, transaction_id: null, paid_at: null }
    ledger = {
      retrieveNedarimAttempt: jest.fn(async () => ({ ...attempt })),
      claimCreation: jest.fn(async (_id, _cart, installments) => { attempt.installments = installments; return new Date() }),
      finishCreation: jest.fn(async () => { attempt.transaction_id = "900"; attempt.transaction_key = "key"; return true }),
    }
    jest.mocked(loadNedarimCart).mockReset().mockResolvedValue(cart as any)
    jest.mocked(createNedarimTransaction).mockClear()
  })
  afterEach(() => { process.env = { ...env } })

  it("locks an allowed count into the new transaction and offers card only", async () => {
    const res = await call({ installments: 3 })
    expect(ledger.claimCreation).toHaveBeenCalledWith("ndp_test", "cart_test", 3)
    expect(jest.mocked(createNedarimTransaction).mock.calls[0][0]).toMatchObject({ installments: 3 })
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", installments: 3,
      plan: { count: 3, first: 50, next: 50, currency_code: "ils" },
      payment: expect.objectContaining({ Methods: "Card", ButtonText: "תשלום ב־3 תשלומים" }) }))
  })
  it("keeps every payment method for a single payment", async () => {
    const res = await call({})
    expect(res.json.mock.calls[0][0].payment.Methods).toBe("Card,GooglePay,Bit")
    expect(res.json.mock.calls[0][0].payment.ButtonText).toBe("תשלום")
    expect(res.json.mock.calls[0][0].plan).toBeUndefined()
  })
  it("refuses more installments than the owner's rule allows for the server amount", async () => {
    const res = await call({ installments: 4 })
    expect(res.json).toHaveBeenCalledWith({ status: "installments_unavailable", max_installments: 3 })
    expect(ledger.claimCreation).not.toHaveBeenCalled()
  })
  it.each([0, -1, 2.5, 37, "abc"])("rejects an invalid count %p before touching the cart", async installments => {
    const res = await call({ installments })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(loadNedarimCart).not.toHaveBeenCalled()
  })
  it("never reuses an opened transaction for a different count", async () => {
    attempt = { ...attempt, transaction_id: "900", transaction_key: "key", installments: 1 }
    const res = await call({ installments: 2 })
    expect(res.json).toHaveBeenCalledWith({ status: "installments_changed" })
    expect(createNedarimTransaction).not.toHaveBeenCalled()
  })
})
