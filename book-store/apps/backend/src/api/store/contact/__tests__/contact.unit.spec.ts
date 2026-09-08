const send = jest.fn()
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send } })) }))
import { POST } from "../route"

describe("contact form delivery", () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CONTACT_EMAIL = "owner@example.com"
    process.env.RESEND_API_KEY = "test-key"
    process.env.RESEND_FROM_EMAIL = "sender@example.com"
  })
  afterAll(() => { process.env = originalEnv })

  async function request(body = {}) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    await POST({ body: { name: "Test User", phone: "0501234567", email: "visitor@example.com", inquiry: "Test inquiry", ...body }, scope: { resolve: () => ({ error: jest.fn() }) } } as any, res as any)
    return res
  }
  it("sends to the configured recipient with the visitor as reply-to", async () => {
    send.mockResolvedValue({ data: { id: "email-1" }, error: null })
    const res = await request()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["owner@example.com"], replyTo: "visitor@example.com" }))
    expect(res.json).toHaveBeenCalledWith({ message: "הפנייה נשלחה" })
  })
  it("reports provider rejection as failure", async () => {
    send.mockResolvedValue({ data: null, error: { message: "rejected" } })
    expect((await request()).status).toHaveBeenCalledWith(502)
  })
  it("reports network failure", async () => {
    send.mockRejectedValue(new Error("network"))
    expect((await request()).status).toHaveBeenCalledWith(502)
  })
  it("rejects invalid input before sending", async () => {
    expect((await request({ email: "invalid" })).status).toHaveBeenCalledWith(400)
    expect(send).not.toHaveBeenCalled()
  })
  it("does not send honeypot submissions", async () => {
    await request({ website: "spam" })
    expect(send).not.toHaveBeenCalled()
  })
  it("requires backend configuration", async () => {
    delete process.env.CONTACT_EMAIL
    expect((await request()).status).toHaveBeenCalledWith(503)
    expect(send).not.toHaveBeenCalled()
  })
})
