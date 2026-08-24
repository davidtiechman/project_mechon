import crypto from "node:crypto"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { EmailOtpChallenge } from "./models/email-otp-challenge"
import { EmailOtpRateLimit } from "./models/email-otp-rate-limit"

const TTL_MS = 10 * 60 * 1000
const RESEND_MS = 60 * 1000
const MAX_ATTEMPTS = 5

export default class EmailOtpModuleService extends MedusaService({
  EmailOtpChallenge,
  EmailOtpRateLimit,
}) {
  private secret() {
    const value = process.env.EMAIL_OTP_HMAC_SECRET
    if (!value || value.length < 32) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "EMAIL_OTP_HMAC_SECRET must contain at least 32 characters")
    }
    return value
  }

  async normalizeEmail(email: string): Promise<string> {
    return email.trim().toLowerCase()
  }

  private digest(value: string) {
    return crypto.createHmac("sha256", this.secret()).update(value).digest("hex")
  }

  private hashIp(ip: string) {
    return this.digest(`ip:${ip}`)
  }

  private hashCode(id: string, email: string, code: string) {
    return this.digest(`otp:${id}:${email}:${code}`)
  }

  async enforceRateLimit(key: string, limit: number, windowMs: number) {
    const keyHash = this.digest(`rate:${key}`)
    const [record] = await this.listEmailOtpRateLimits({ key_hash: keyHash })
    const now = new Date()
    if (!record) {
      await this.createEmailOtpRateLimits({ key_hash: keyHash, window_started_at: now, request_count: 1 })
      return
    }
    if (now.getTime() - new Date(record.window_started_at).getTime() >= windowMs) {
      await this.updateEmailOtpRateLimits({ id: record.id, window_started_at: now, request_count: 1 })
      return
    }
    if (record.request_count >= limit) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many requests")
    }
    await this.updateEmailOtpRateLimits({ id: record.id, request_count: record.request_count + 1 })
  }

  async createChallenge(emailInput: string, authIdentityId: string, ip: string) {
    const email = await this.normalizeEmail(emailInput)
    await this.enforceRateLimit(`email:${email}`, 5, 60 * 60 * 1000)
    await this.enforceRateLimit(`ip:${ip}`, 20, 60 * 60 * 1000)

    const active = await this.listEmailOtpChallenges({ email, consumed_at: null, invalidated_at: null }, { order: { created_at: "DESC" }, take: 1 })
    const now = new Date()
    if (active[0] && now.getTime() - new Date(active[0].created_at).getTime() < RESEND_MS) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Please wait before requesting another code")
    }
    if (active.length) {
      await this.updateEmailOtpChallenges({ id: active[0].id, invalidated_at: now })
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
    const id = `emailotp_${crypto.randomUUID().replaceAll("-", "")}`
    const challenge = await this.createEmailOtpChallenges({
      id,
      email,
      auth_identity_id: authIdentityId,
      code_hash: this.hashCode(id, email, code),
      ip_hash: this.hashIp(ip),
      expires_at: new Date(now.getTime() + TTL_MS),
      attempt_count: 0,
      consumed_at: null,
      invalidated_at: null,
    })
    return { challenge, code }
  }

  async consume(emailInput: string, code: string) {
    const email = await this.normalizeEmail(emailInput)
    const [challenge] = await this.listEmailOtpChallenges(
      { email, consumed_at: null, invalidated_at: null },
      { order: { created_at: "DESC" }, take: 1 }
    )
    if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempt_count >= MAX_ATTEMPTS) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid or expired code")
    }
    const expected = Buffer.from(challenge.code_hash, "hex")
    const actual = Buffer.from(this.hashCode(challenge.id, email, code), "hex")
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      const attempts = challenge.attempt_count + 1
      await this.updateEmailOtpChallenges({
        id: challenge.id,
        attempt_count: attempts,
        invalidated_at: attempts >= MAX_ATTEMPTS ? new Date() : null,
      })
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid or expired code")
    }
    await this.updateEmailOtpChallenges({ id: challenge.id, consumed_at: new Date() })
    return challenge
  }
}
