import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import SiteContentModule from "../modules/site-content"

export default defineLink(
  SiteContentModule.linkable.brand,
  { linkable: ProductModule.linkable.product, isList: true }
)
