import { model } from "@medusajs/framework/utils"

export const EmailOtpChallenge = model.define("email_otp_challenge", {
  id: model.id({ prefix: "emailotp" }).primaryKey(),
  email: model.text(),
  auth_identity_id: model.text(),
  code_hash: model.text(),
  ip_hash: model.text(),
  expires_at: model.dateTime(),
  attempt_count: model.number().default(0),
  consumed_at: model.dateTime().nullable(),
  invalidated_at: model.dateTime().nullable(),
})
  .indexes([
    { name: "IDX_email_otp_email", on: ["email"] },
    { name: "IDX_email_otp_auth_identity", on: ["auth_identity_id"] },
    { name: "IDX_email_otp_expires_at", on: ["expires_at"] },
  ])
