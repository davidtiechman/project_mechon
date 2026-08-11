import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const [[, pages], [, brands], [, articles], [, drafts], recent] = await Promise.all([
    service.listAndCountContentPages({}, { take: 1 }),
    service.listAndCountBrands({}, { take: 1 }),
    service.listAndCountArticles({}, { take: 1 }),
    service.listAndCountArticles({ status: "draft" }, { take: 1 }),
    service.listArticles({}, { take: 5, order: { updated_at: "DESC" }, select: ["id", "title", "status", "updated_at"] }),
  ])
  res.json({ counts: { pages, brands, articles, drafts }, recent })
}
