import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { SITE_CONTENT_MODULE } from "../../../../../modules/site-content"
import { contentEntities, resolveContentEntity } from "../../../../site-content/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  if (!["pages", "brands", "articles"].includes(entity)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found")
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const [items] = await service[contentEntities[entity].list]({ slug: req.params.slug, status: "published" }, { take: 1 })
  if (!items[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Content not found")
  if (entity === "brands") {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data } = await query.graph({ entity: "brand", fields: ["product.id", "product.handle", "product.title", "product.thumbnail"], filters: { id: items[0].id } })
    items[0].products = data[0]?.product || []
  }
  res.json({ item: items[0] })
}
