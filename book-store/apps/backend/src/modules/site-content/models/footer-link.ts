import { model } from "@medusajs/framework/utils"

const FooterLink = model.define("site_content_footer_link", {
  id: model.id().primaryKey(),
  section_id: model.text(),
  label: model.text(),
  url: model.text(),
  open_new_tab: model.boolean().default(false),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default FooterLink
