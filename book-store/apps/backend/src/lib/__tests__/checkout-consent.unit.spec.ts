import { CHECKOUT_CONSENT_ERROR, CHECKOUT_TERMS_VERSION, createCheckoutConsent, validateCheckoutConsent } from "../checkout-consent"
import { POST } from "../../api/store/carts/[id]/terms-acceptance/route"
jest.mock("@medusajs/medusa/core-flows", () => ({ completeCartWorkflow: { hooks: { validate: jest.fn() } } }))
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import "../../workflows/hooks/validate-checkout-consent"

const secret = "unit-test-signing-secret"
describe("checkout consent", () => {
  it("blocks workflow completion without consent and permits a valid receipt", async () => {
    const handler = (completeCartWorkflow.hooks.validate as jest.Mock).mock.calls[0][0]
    const container = { resolve: () => ({ projectConfig: { http: { jwtSecret: secret } } }) }
    await expect(handler({ cart: { id: "cart_1", metadata: {} } }, { container })).rejects.toThrow(CHECKOUT_CONSENT_ERROR)
    const receipt = createCheckoutConsent("cart_1", secret)
    await expect(handler({ cart: { id: "cart_1", metadata: { checkout_consent: receipt } } }, { container })).resolves.toBeUndefined()
  })
  it("records a server timestamp and current version, bound to the cart", () => {
    const before = Date.now()
    const receipt = createCheckoutConsent("cart_1", secret)
    expect(receipt.accepted).toBe(true)
    expect(receipt.terms_version).toBe(CHECKOUT_TERMS_VERSION)
    expect(Date.parse(receipt.accepted_at)).toBeGreaterThanOrEqual(before)
    expect(() => validateCheckoutConsent("cart_1", receipt, secret)).not.toThrow()
    expect(() => validateCheckoutConsent("cart_2", receipt, secret)).toThrow(CHECKOUT_CONSENT_ERROR)
  })
  it("rejects absent, unchecked, stale, or forged approval", () => {
    const receipt = createCheckoutConsent("cart_1", secret)
    for (const invalid of [null, {}, { ...receipt, accepted: false },
      { ...receipt, terms_version: "old-version" },
      { ...receipt, accepted_at: "2020-01-01T00:00:00.000Z" },
      { ...receipt, signature: "a".repeat(64) }]) {
      expect(() => validateCheckoutConsent("cart_1", invalid, secret)).toThrow(CHECKOUT_CONSENT_ERROR)
    }
  })
  function request(body: unknown, completed = false) {
    const cart = { id: "cart_1", metadata: { existing: "preserved" }, completed_at: completed ? new Date() : null }
    const carts = { retrieveCart: jest.fn().mockResolvedValue(cart), updateCarts: jest.fn().mockResolvedValue({}) }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    const req = { body, params: { id: cart.id }, scope: { resolve: (name: string) => name === "cart" ? carts : { projectConfig: { http: { jwtSecret: secret } } } } }
    return { req, res, carts }
  }
  it("saves approval in cart metadata without overwriting other metadata or trusting client time", async () => {
    const { req, res, carts } = request({ accepted: true, terms_version: CHECKOUT_TERMS_VERSION, accepted_at: "forged" })
    await POST(req as any, res as any)
    const saved = carts.updateCarts.mock.calls[0][1].metadata
    expect(saved.existing).toBe("preserved")
    expect(saved.checkout_consent.accepted_at).not.toBe("forged")
    expect(() => validateCheckoutConsent("cart_1", saved.checkout_consent, secret)).not.toThrow()
    expect(res.status).not.toHaveBeenCalled()
  })
  it.each([{}, { accepted: false, terms_version: CHECKOUT_TERMS_VERSION }, { accepted: "true", terms_version: CHECKOUT_TERMS_VERSION }, { accepted: true, terms_version: "old" }])("rejects invalid input before writing: %j", async (body) => {
    const { req, res, carts } = request(body)
    await POST(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(carts.updateCarts).not.toHaveBeenCalled()
  })
  it("does not rewrite consent for a completed order", async () => {
    const { req, res, carts } = request({ accepted: true, terms_version: CHECKOUT_TERMS_VERSION }, true)
    await POST(req as any, res as any)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(carts.updateCarts).not.toHaveBeenCalled()
  })
})
