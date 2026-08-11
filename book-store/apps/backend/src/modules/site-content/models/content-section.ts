import { model } from "@medusajs/framework/utils"

const ContentSection = model.define("site_content_section", {
  id: model.id().primaryKey(),
  owner_type: model.enum(["home", "page", "brand"]),
  owner_id: model.text(),
  type: model.enum(["hero", "text", "image_text", "banner", "cta", "products", "brands", "articles", "gallery", "faq"]),
  internal_name: model.text(),
  title: model.text().nullable(),
  subtitle: model.text().nullable(),
  content: model.text().nullable(),
  data: model.json().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default ContentSection
