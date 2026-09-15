import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"
import { contentEntities, listConfig, resolveContentEntity } from "../../../site-content/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const { filters, config } = listConfig(entity, req.query as Record<string, unknown>)
  if (["pages", "brands", "articles"].includes(entity)) filters.status = "published"
  if (["sections", "banners", "advertisements", "navigation-menus", "navigation-items", "faq", "footer-sections", "footer-links"].includes(entity)) filters.active = true
  const [listedItems, count] = await service[contentEntities[entity].list](filters, config)
  const now = Date.now()
  const isScheduledContent = entity === "banners" || entity === "advertisements"
  const items = isScheduledContent
    ? listedItems.filter((item: any) =>
        (!item.start_at || new Date(item.start_at).getTime() <= now) &&
        (!item.end_at || new Date(item.end_at).getTime() >= now)
      )
    : listedItems
  if (entity === "brands" && items.length) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data } = await query.graph({
      entity: "brand",
      fields: ["id", "product.id", "product.handle", "product.title", "product.thumbnail"],
      filters: { id: items.map((item: any) => item.id) },
    })
    const productsByBrand = new Map(data.map((brand: any) => [brand.id, brand.product || []]))
    items.forEach((item: any) => {
      item.products = productsByBrand.get(item.id) || []
    })
  }
  res.json({ items, count: isScheduledContent ? items.length : count })
}
