import { model } from "@medusajs/framework/utils"

const Advertisement = model.define("site_content_advertisement", {
  id: model.id().primaryKey(),
  internal_name: model.text(),
  title: model.text().nullable(),
  body: model.text().nullable(),
  desktop_image: model.text().nullable(),
  mobile_image: model.text().nullable(),
  image_alt: model.text().nullable(),
  button_text: model.text().nullable(),
  button_url: model.text().nullable(),
  open_new_tab: model.boolean().default(false),
  show_delay_seconds: model.number().default(0),
  auto_close_seconds: model.number().default(6),
  show_timer: model.boolean().default(true),
  display_frequency: model.enum(["always", "once_session", "once_ever"]).default("once_session"),
  start_at: model.dateTime().nullable(),
  end_at: model.dateTime().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default Advertisement
