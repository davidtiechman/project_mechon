import { model } from "@medusajs/framework/utils"

export const NedarimSync = model.define("nedarim_sync", {
  id: model.text().primaryKey(),
  last_id: model.text().default("0"),
  next_run_at: model.dateTime(),
})
