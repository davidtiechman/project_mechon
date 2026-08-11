import { model } from "@medusajs/framework/utils"

const Banner = model.define("site_content_banner", {
  id: model.id().primaryKey(),
  internal_name: model.text(),
  title: model.text().nullable(),
  subtitle: model.text().nullable(),
  desktop_image: model.text().nullable(),
  mobile_image: model.text().nullable(),
  image_alt: model.text().nullable(),
  button_text: model.text().nullable(),
  button_url: model.text().nullable(),
  open_new_tab: model.boolean().default(false),
  placement: model.enum(["homepage_top", "homepage_middle", "products", "articles", "global"]),
  start_at: model.dateTime().nullable(),
  end_at: model.dateTime().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default Banner
