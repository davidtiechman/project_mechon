import { model } from "@medusajs/framework/utils"

const NavigationMenu = model.define("site_content_navigation_menu", {
  id: model.id().primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  active: model.boolean().default(true),
})

export default NavigationMenu
