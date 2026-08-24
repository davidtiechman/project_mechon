import EmailOtpModuleService from "../service"

describe("EmailOtpModuleService", () => {
  let service: EmailOtpModuleService
  let records: any[]

  beforeEach(() => {
    process.env.EMAIL_OTP_HMAC_SECRET = "unit-test-secret-that-is-at-least-32-characters"
    records = []
    service = Object.create(EmailOtpModuleService.prototype)
    ;(service as any).enforceRateLimit = jest.fn()
    ;(service as any).listEmailOtpChallenges = jest.fn(async (filters: any) => records
      .filter((item) => item.email === filters.email && item.consumed_at === null && item.invalidated_at === null)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 1))
    ;(service as any).createEmailOtpChallenges = jest.fn(async (data: any) => {
      const value = { ...data, created_at: new Date(), updated_at: new Date() }
      records.push(value)
      return value
    })
    ;(service as any).updateEmailOtpChallenges = jest.fn(async (data: any) => {
      const value = records.find((item) => item.id === data.id)
      Object.assign(value, data, { updated_at: new Date() })
      return value
    })
  })

  it("accepts a correct code once and rejects reuse", async () => {
    const { code } = await service.createChallenge("User@Example.com", "auth_1", "127.0.0.1")
    await expect(service.consume("user@example.com", code)).resolves.toBeDefined()
    await expect(service.consume("user@example.com", code)).rejects.toThrow("Invalid or expired code")
  })

  it("invalidates a challenge after five wrong attempts", async () => {
    await service.createChallenge("user@example.com", "auth_1", "127.0.0.1")
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(service.consume("user@example.com", "000000")).rejects.toThrow("Invalid or expired code")
    }
    expect(records[0].attempt_count).toBe(5)
    expect(records[0].invalidated_at).toBeInstanceOf(Date)
  })

  it("a new challenge invalidates the previous challenge", async () => {
    const first = await service.createChallenge("user@example.com", "auth_1", "127.0.0.1")
    records[0].created_at = new Date(Date.now() - 61_000)
    await service.createChallenge("user@example.com", "auth_1", "127.0.0.1")
    expect(first.challenge.invalidated_at).toBeInstanceOf(Date)
    expect(records).toHaveLength(2)
  })

  it("rejects an expired challenge", async () => {
    const { code } = await service.createChallenge("user@example.com", "auth_1", "127.0.0.1")
    records[0].expires_at = new Date(Date.now() - 1)
    await expect(service.consume("user@example.com", code)).rejects.toThrow("Invalid or expired code")
  })
})
