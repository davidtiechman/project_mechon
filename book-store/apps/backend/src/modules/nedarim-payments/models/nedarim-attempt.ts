import { model } from "@medusajs/framework/utils"

export const NedarimAttemptModel = model.define("nedarim_attempt", {
  id: model.id({ prefix: "ndp" }).primaryKey(),
  session_id: model.text(),
  cart_id: model.text().nullable(),
  amount_minor: model.number(),
  currency_code: model.text(),
  transaction_id: model.text().nullable(),
  transaction_key: model.text().nullable(),
  payment_id: model.text().nullable(),
  payment_method: model.text().nullable(),
  creation_started_at: model.dateTime().nullable(),
  paid_at: model.dateTime().nullable(),
  canceled_at: model.dateTime().nullable(),
  processed_at: model.dateTime().nullable(),
}).indexes([
  { on: ["session_id"] },
  { on: ["cart_id"] },
  { on: ["payment_id"], unique: true },
])
