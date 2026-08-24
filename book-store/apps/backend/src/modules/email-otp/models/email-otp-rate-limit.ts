import { model } from "@medusajs/framework/utils"

export const EmailOtpRateLimit = model.define("email_otp_rate_limit", {
  id: model.id({ prefix: "emailotprl" }).primaryKey(),
  key_hash: model.text().unique(),
  window_started_at: model.dateTime(),
  request_count: model.number().default(0),
})
