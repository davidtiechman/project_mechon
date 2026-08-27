import { model } from "@medusajs/framework/utils"

const Catalog = model.define("site_content_catalog", {
  id: model.id().primaryKey(),
  file_key: model.text(),
  file_url: model.text(),
  file_name: model.text(),
  mime_type: model.text().default("application/pdf"),
  active: model.boolean().default(true),
})

export default Catalog
