import { model } from "@medusajs/framework/utils"

const ContentPage = model.define("site_content_page", {
  id: model.id().primaryKey(),
  title: model.text(),
  slug: model.text().unique(),
  excerpt: model.text().nullable(),
  content: model.text().nullable(),
  hero_image: model.text().nullable(),
  mobile_image: model.text().nullable(),
  image_alt: model.text().nullable(),
  status: model.enum(["draft", "published", "archived"]).default("draft"),
  sort_order: model.number().default(0),
  seo: model.json().nullable(),
  published_at: model.dateTime().nullable(),
})

export default ContentPage
