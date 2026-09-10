const updateCartRun = jest.fn()
jest.mock("@medusajs/medusa/core-flows", () => ({ updateCartWorkflow: () => ({ run: updateCartRun }) }))
import { canSendMarketing, MARKETING_CONSENT_VERSION, marketingUnsubscribeToken, readMarketingConsent, revokeMarketingConsent, saveMarketingConsent, unsubscribeWithToken } from "../marketing-consent"
import { POST as checkout } from "../../api/store/carts/[id]/marketing-consent/route"

describe("marketing consent metadata", () => {
  let records: Record<string, any>
  let customers: any
  let container: any
  const originalEnabled = process.env.MARKETING_DELIVERY_ENABLED
  beforeEach(() => {
    updateCartRun.mockReset()
    records = {
      cus_guest: { id: "cus_guest", email: "reader@example.com", phone: "0501234567", has_account: false, metadata: { other: "keep" } },
      cus_account: { id: "cus_account", email: "reader@example.com", phone: "0501234567", has_account: true, metadata: {} },
    }
    customers = {
      retrieveCustomer: jest.fn(async (id) => records[id]),
      updateCustomers: jest.fn(async (id, update) => { Object.assign(records[id], update); return records[id] }),
      listCustomers: jest.fn(async ({ email }, { skip, take }) => Object.values(records).filter((item) => item.email === email).slice(skip, skip + take)),
    }
    container = { resolve: (key: string) => key === "customer" ? customers : { projectConfig: { http: { jwtSecret: "test-secret" } } } }
    process.env.MARKETING_DELIVERY_ENABLED = "true"
  })
  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.MARKETING_DELIVERY_ENABLED
    else process.env.MARKETING_DELIVERY_ENABLED = originalEnabled
  })
  it("does not infer consent from a customer or a purchase", async () => {
    expect(await canSendMarketing(container, "cus_guest", "email", "reader@example.com")).toBe(false)
    await saveMarketingConsent(container, "cus_guest", false, "checkout", MARKETING_CONSENT_VERSION)
    expect(records.cus_guest.metadata.marketing_consent.status).toBe("not_subscribed")
    expect(records.cus_guest.metadata.marketing_consent.consented_at).toBeNull()
    expect(await canSendMarketing(container, "cus_guest", "email", "reader@example.com")).toBe(false)
  })
  it("records explicit consent, server time, source, version and preserves other metadata", async () => {
    const start = Date.now()
    const receipt = await saveMarketingConsent(container, "cus_account", true, "registration", MARKETING_CONSENT_VERSION)
    expect(receipt).toMatchObject({ status: "subscribed", source: "registration", version: MARKETING_CONSENT_VERSION, revoked_at: null })
    expect(Date.parse(receipt.consented_at!)).toBeGreaterThanOrEqual(start)
    expect(readMarketingConsent(container, "cus_account", receipt)).toEqual(receipt)
    expect(await canSendMarketing(container, "cus_account", "email", "reader@example.com")).toBe(true)
    await saveMarketingConsent(container, "cus_guest", true, "checkout", MARKETING_CONSENT_VERSION)
    expect(records.cus_guest.metadata.other).toBe("keep")
  })
  it("an unchecked optional checkbox does not revoke an existing subscription", async () => {
    const receipt = await saveMarketingConsent(container, "cus_guest", true, "checkout", MARKETING_CONSENT_VERSION)
    await saveMarketingConsent(container, "cus_guest", false, "registration", MARKETING_CONSENT_VERSION)
    expect(records.cus_guest.metadata.marketing_consent).toEqual(receipt)
  })
  it("withdraws for guest and registered identities and prevents old order snapshots authorizing sends", async () => {
    const oldOrderSnapshot = await saveMarketingConsent(container, "cus_guest", true, "checkout", MARKETING_CONSENT_VERSION)
    await saveMarketingConsent(container, "cus_account", true, "registration", MARKETING_CONSENT_VERSION)
    await revokeMarketingConsent(container, "cus_guest")
    for (const id of Object.keys(records)) {
      expect(records[id].metadata.marketing_consent.status).toBe("unsubscribed")
      expect(records[id].metadata.marketing_consent.revoked_at).toBeTruthy()
      expect(await canSendMarketing(container, id, "email", "reader@example.com")).toBe(false)
    }
    expect(oldOrderSnapshot.status).toBe("subscribed")
    expect(records.cus_guest.metadata.marketing_consent.consented_at).toBe(oldOrderSnapshot.consented_at)
  })
  it("requires fresh explicit opt-in after withdrawal and retains the last withdrawal time", async () => {
    await revokeMarketingConsent(container, "cus_account")
    const revokedAt = records.cus_account.metadata.marketing_consent.revoked_at
    await saveMarketingConsent(container, "cus_account", false, "checkout", MARKETING_CONSENT_VERSION)
    expect(await canSendMarketing(container, "cus_account", "email", "reader@example.com")).toBe(false)
    await saveMarketingConsent(container, "cus_account", true, "account", MARKETING_CONSENT_VERSION)
    expect(records.cus_account.metadata.marketing_consent.revoked_at).toBe(revokedAt)
    expect(await canSendMarketing(container, "cus_account", "email", "reader@example.com")).toBe(true)
  })
  it("rejects tampered metadata and cannot reuse consent for a changed recipient", async () => {
    await saveMarketingConsent(container, "cus_account", true, "registration", MARKETING_CONSENT_VERSION)
    expect(await canSendMarketing(container, "cus_account", "email", "other@example.com")).toBe(false)
    records.cus_account.email = "other@example.com"
    expect(await canSendMarketing(container, "cus_account", "email", "reader@example.com")).toBe(false)
    records.cus_account.metadata.marketing_consent.email = "other@example.com"
    expect(await canSendMarketing(container, "cus_account", "email", "other@example.com")).toBe(false)
  })
  it("rejects stale consent wording and keeps delivery disabled by default", async () => {
    await expect(saveMarketingConsent(container, "cus_account", true, "account", "old")).rejects.toThrow()
    await saveMarketingConsent(container, "cus_account", true, "account", MARKETING_CONSENT_VERSION)
    delete process.env.MARKETING_DELIVERY_ENABLED
    expect(await canSendMarketing(container, "cus_account", "email", "reader@example.com")).toBe(false)
  })
  it("supports guest removal without login using a signed token, rejecting altered tokens", async () => {
    await saveMarketingConsent(container, "cus_guest", true, "checkout", MARKETING_CONSENT_VERSION)
    const token = marketingUnsubscribeToken(container, "cus_guest")
    await expect(unsubscribeWithToken(container, `${token}x`)).rejects.toThrow()
    await unsubscribeWithToken(container, token)
    const time = records.cus_guest.metadata.marketing_consent.revoked_at
    await unsubscribeWithToken(container, token)
    expect(records.cus_guest.metadata.marketing_consent.revoked_at).toBe(time)
    expect(await canSendMarketing(container, "cus_guest", "email", "reader@example.com")).toBe(false)
  })
  it("saves a checkout snapshot alongside mandatory terms metadata", async () => {
    const cart = { id: "cart_1", customer_id: "cus_guest", email: "reader@example.com", shipping_address: { phone: "0501234567" }, metadata: { checkout_consent: { accepted: true } } }
    const carts = { retrieveCart: jest.fn(async () => cart), updateCarts: jest.fn(async (..._args: any[]) => ({})) }
    const scope = { resolve: (key: string) => key === "cart" ? carts : container.resolve(key) }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    await checkout({ params: { id: cart.id }, body: { accepted: true, version: MARKETING_CONSENT_VERSION }, scope } as any, res as any)
    expect(carts.updateCarts).toHaveBeenCalledWith(cart.id, { metadata: expect.objectContaining({ checkout_consent: { accepted: true }, marketing_consent: expect.objectContaining({ status: "subscribed", source: "checkout", checkout_opt_in: true }) }) })
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, unsubscribe_token: expect.any(String) }))
  })
  it("links a cart without a customer before saving consent and returns a working removal token", async () => {
    const cart: any = { id: "cart_1", email: "reader@example.com", metadata: {} }
    const carts = { retrieveCart: jest.fn(async () => cart), updateCarts: jest.fn(async () => ({})) }
    updateCartRun.mockImplementation(async () => { cart.customer_id = "cus_guest" })
    const scope = { resolve: (key: string) => key === "cart" ? carts : container.resolve(key) }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    const req: any = { params: { id: cart.id }, body: { accepted: true, version: "old" }, scope }
    await expect(checkout(req, res as any)).rejects.toThrow()
    expect(updateCartRun).not.toHaveBeenCalled()
    req.body.version = MARKETING_CONSENT_VERSION
    await checkout(req, res as any)
    expect(updateCartRun).toHaveBeenCalledWith({ input: { id: cart.id, email: cart.email } })
    const snapshot = carts.updateCarts.mock.calls[0][1].metadata.marketing_consent
    expect(snapshot.consented_at).toBe(records.cus_guest.metadata.marketing_consent.consented_at)
    expect(snapshot.version).toBe(MARKETING_CONSENT_VERSION)
    await unsubscribeWithToken(container, res.json.mock.calls[0][0].unsubscribe_token)
    expect(records.cus_guest.metadata.marketing_consent.status).toBe("unsubscribed")
  })
  it("does not report success when customer linking fails", async () => {
    const cart = { id: "cart_1", email: "reader@example.com" }
    const carts = { retrieveCart: jest.fn(async () => cart), updateCarts: jest.fn() }
    updateCartRun.mockRejectedValue(new Error("temporary failure"))
    const scope = { resolve: (key: string) => key === "cart" ? carts : container.resolve(key) }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    await expect(checkout({ params: { id: cart.id }, body: { accepted: true, version: MARKETING_CONSENT_VERSION }, scope } as any, res as any)).rejects.toThrow("temporary failure")
    expect(res.json).not.toHaveBeenCalled()
    expect(carts.updateCarts).not.toHaveBeenCalled()
  })

})
