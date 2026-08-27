import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const [catalog] = await service.listCatalogs(
    { active: true },
    { take: 1, order: { updated_at: "DESC" } }
  )

  if (!catalog) {
    return res.json({ active: false, catalog: null })
  }

  res.json({
    active: true,
    catalog: {
      file_url: catalog.file_url,
      file_name: catalog.file_name,
      updated_at: catalog.updated_at,
    },
  })
}
