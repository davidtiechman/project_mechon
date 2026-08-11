import { model } from "@medusajs/framework/utils"

const NavigationItem = model.define("site_content_navigation_item", {
  id: model.id().primaryKey(),
  menu_id: model.text(),
  parent_id: model.text().nullable(),
  label: model.text(),
  url: model.text(),
  open_new_tab: model.boolean().default(false),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default NavigationItem
