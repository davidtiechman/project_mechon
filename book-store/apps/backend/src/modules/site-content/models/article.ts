import { model } from "@medusajs/framework/utils"

const Article = model.define({ name: "article", tableName: "site_content_article" }, {
  id: model.id().primaryKey(),
  title: model.text(),
  slug: model.text().unique(),
  excerpt: model.text().nullable(),
  content: model.text().nullable(),
  featured_image: model.text().nullable(),
  image_alt: model.text().nullable(),
  author: model.text().nullable(),
  published_at: model.dateTime().nullable(),
  status: model.enum(["draft", "published", "archived"]).default("draft"),
  related_brand_ids: model.array().default([]),
  related_article_ids: model.array().default([]),
  seo: model.json().nullable(),
})

export default Article
