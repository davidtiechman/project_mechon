import { model } from "@medusajs/framework/utils"

const Brand = model.define({ name: "brand", tableName: "site_content_brand" }, {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  title: model.text().nullable(),
  subtitle: model.text().nullable(),
  short_description: model.text().nullable(),
  content: model.text().nullable(),
  logo: model.text().nullable(),
  hero_image: model.text().nullable(),
  mobile_image: model.text().nullable(),
  image_alt: model.text().nullable(),
  status: model.enum(["draft", "published", "archived"]).default("draft"),
  sort_order: model.number().default(0),
  seo: model.json().nullable(),
  published_at: model.dateTime().nullable(),
})

export default Brand
