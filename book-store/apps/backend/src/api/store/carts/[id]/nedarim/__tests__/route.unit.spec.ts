import { POST } from "../route"

describe("pausing new Nedarim payments", () => {
  it("blocks transaction creation server-side before accessing a cart or a payment provider", async () => {
    const original = process.env.NEDARIM_ACCEPT_NEW_PAYMENTS
    process.env.NEDARIM_ACCEPT_NEW_PAYMENTS = "false"
    try {
      const resolve = jest.fn(() => { throw new Error("A paused checkout must not access payment services") })
      const req = { params: { id: "cart_test" }, body: { enabled: true }, scope: { resolve } }
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
      await POST(req as any, res as any)
      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "nedarim_payments_paused" }))
      expect(resolve).not.toHaveBeenCalled()
    } finally {
      if (original === undefined) delete process.env.NEDARIM_ACCEPT_NEW_PAYMENTS
      else process.env.NEDARIM_ACCEPT_NEW_PAYMENTS = original
    }
  })
})
