import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"
import { contentEntities, listConfig, resolveContentEntity } from "../../../site-content/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const { filters, config } = listConfig(req.query as Record<string, unknown>)
  if (["pages", "brands", "articles"].includes(entity)) filters.status = "published"
  if (["sections", "banners", "navigation-menus", "navigation-items", "faq", "footer-sections", "footer-links"].includes(entity)) filters.active = true
  const [items, count] = await service[contentEntities[entity].list](filters, config)
  res.json({ items, count })
}
