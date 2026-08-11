import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SITE_CONTENT_MODULE } from "../../../../../../modules/site-content"

const definition = (brandId: string, productId: string) => ({
  [SITE_CONTENT_MODULE]: { brand_id: brandId },
  [Modules.PRODUCT]: { product_id: productId },
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const { data } = await query.graph({ entity: "brand", fields: ["id", "product.id", "product.title", "product.thumbnail"], filters: { id: req.params.id } })
  res.json({ products: data[0]?.product || [] })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK) as any
  const productIds = Array.isArray((req.body as any)?.product_ids) ? (req.body as any).product_ids.filter((id: unknown) => typeof id === "string") : []
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const { data } = await query.graph({ entity: "brand", fields: ["id", "product.id"], filters: { id: req.params.id } })
  const currentIds: string[] = (data[0]?.product || []).map((product: any) => product.id)
  const removed = currentIds.filter((id) => !productIds.includes(id))
  const added = productIds.filter((id: string) => !currentIds.includes(id))
  if (removed.length) await remoteLink.dismiss(removed.map((id) => definition(req.params.id, id)))
  if (added.length) await remoteLink.create(added.map((id: string) => definition(req.params.id, id)))
  res.json({ product_ids: productIds })
}
