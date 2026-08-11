import { model } from "@medusajs/framework/utils"

const FaqItem = model.define("site_content_faq_item", {
  id: model.id().primaryKey(),
  question: model.text(),
  answer: model.text(),
  group: model.text().nullable(),
  active: model.boolean().default(true),
  sort_order: model.number().default(0),
})

export default FaqItem
