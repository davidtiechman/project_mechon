jest.mock("../../../../../workflows/create-quick-book", () => ({ createQuickBookWorkflow: jest.fn() }))
jest.mock("../../settings/data", () => ({ loadQuickSettings: jest.fn() }))
import { POST } from "../route"
import { createQuickBookWorkflow } from "../../../../../workflows/create-quick-book"
import { loadQuickSettings } from "../../settings/data"
import { fixture } from "../../../../../shared/__tests__/quick-book-fixture"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

function context() {
  const products = new Map<string, any>()
  const run = jest.fn(async ({ input }) => {
    products.set(input.productId, { id: input.productId, title: input.book.title, metadata: { quick_book_complete: true, quick_book_fingerprint: input.fingerprint } })
  })
  ;(createQuickBookWorkflow as unknown as jest.Mock).mockReturnValue({ run })
  const settings = { channels: [{ id: "sc_1" }], profiles: [{ id: "sp_1" }], currencies: ["ils"], brands: [{ id: "brand_1" }], collections: [{ id: "col_1" }], categories: [{ id: "cat_1" }], locations: ["loc_1", "loc_2"].map((id) => ({ id, sales_channels: [{ id: "sc_1" }], fulfillment_sets: [{ id: "fs_1" }] })), shipping: [{ shipping_profile_id: "sp_1", service_zone: { fulfillment_set_id: "fs_1" } }] }
  ;(loadQuickSettings as jest.Mock).mockResolvedValue(settings)
  const service = { listProducts: jest.fn(async (filter) => filter.id ? [...products.values()].filter((p) => p.id === filter.id) : []), listProductVariants: jest.fn(async () => []) }
  let queue = Promise.resolve()
  const lock = { execute: jest.fn((_key, job) => { const next = queue.then(job); queue = next.catch(() => undefined); return next }) }
  const req: any = { body: fixture(), auth_context: { actor_id: "user_1" }, scope: { resolve: (key: string) => key === Modules.PRODUCT ? service : key === Modules.LOCKING ? lock : key === ContainerRegistrationKeys.LOGGER ? { error: jest.fn() } : undefined } }
  const response = () => { const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }; return res }
  return { req, response, run, products, service, settings }
}

describe("quick book Admin route", () => {
  it("creates once even with concurrent retries and a lost response", async () => {
    const { req, response, run } = context(); const a = response(), b = response()
    await Promise.all([POST(req, a), POST(req, b)])
    expect(run).toHaveBeenCalledTimes(1)
    expect(a.json.mock.calls[0][0].product.id).toBe(b.json.mock.calls[0][0].product.id)
    const input = run.mock.calls[0][0].input
    expect(input.book.variants[0].stock[0].quantity).toBe(0)
  })
  it("allows an identical retry after a compensated mid-save failure", async () => {
    const { req, response, run } = context(); run.mockRejectedValueOnce(new Error("provider failed"))
    const a = response(); await POST(req, a)
    expect(a.json).toHaveBeenCalledWith({ code: "saveError" })
    const b = response(); await POST(req, b)
    expect(b.status).toHaveBeenCalledWith(201)
    expect(run).toHaveBeenCalledTimes(2)
  })
  it("reports a remaining partial product and prevents duplicate creation", async () => {
    const { req, response, run, products } = context()
    run.mockImplementationOnce(async ({ input }) => { products.set(input.productId, { id: input.productId, metadata: { quick_book_complete: false, quick_book_fingerprint: input.fingerprint } }); throw new Error("rollback failed") })
    const a = response(); await POST(req, a)
    expect(a.json.mock.calls[0][0].code).toBe("partial")
    const b = response(); await POST(req, b)
    expect(b.json.mock.calls[0][0].code).toBe("partial")
    expect(run).toHaveBeenCalledTimes(1)
  })
  it("rejects a deleted default before creation", async () => {
    const { req, response, run, settings } = context(); settings.profiles = []
    const res = response(); await POST(req, res)
    expect(res.json).toHaveBeenCalledWith({ code: "staleSettings" }); expect(run).not.toHaveBeenCalled()
  })
  it("rejects existing SKUs and handles without updating existing products", async () => {
    const { req, response, service, run } = context(); service.listProductVariants.mockResolvedValueOnce([{ id: "existing" }] as never)
    const res = response(); await POST(req, res)
    expect(res.json).toHaveBeenCalledWith({ code: "duplicateSku" }); expect(run).not.toHaveBeenCalled()
    service.listProducts.mockImplementation(async (filter) => filter.handle ? [{ id: "existing" }] : [])
    const b = response(); await POST(req, b); expect(b.json).toHaveBeenCalledWith({ code: "handleConflict" })
  })
  it("blocks unauthenticated access before accessing services", async () => {
    const { req, response, run } = context(); req.auth_context = undefined
    const res = response(); await POST(req, res)
    expect(res.status).toHaveBeenCalledWith(401); expect(run).not.toHaveBeenCalled()
  })
})
