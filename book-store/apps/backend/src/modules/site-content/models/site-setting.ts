import { model } from "@medusajs/framework/utils"

const SiteSetting = model.define("site_content_site_setting", {
  id: model.id().primaryKey(),
  key: model.text().unique(),
  value: model.json(),
})

export default SiteSetting
