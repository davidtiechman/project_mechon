import { model } from "@medusajs/framework/utils"

const FooterSection = model.define("site_content_footer_section", {
  id: model.id().primaryKey(),
  title: model.text(),
  content: model.text().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default FooterSection
