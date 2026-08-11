import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const [sections, articles, brands, banners] = await Promise.all([
    service.listContentSections({ owner_type: "home", owner_id: "home", active: true }, { order: { sort_order: "ASC" } }),
    service.listArticles({ status: "published" }, { take: 3, order: { published_at: "DESC" } }),
    service.listBrands({ status: "published" }, { order: { sort_order: "ASC" } }),
    service.listBanners({ active: true }, { order: { sort_order: "ASC" } }),
  ])
  res.json({ sections, articles, brands, banners })
}
