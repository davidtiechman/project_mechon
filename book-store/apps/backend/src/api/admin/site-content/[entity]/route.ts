import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"
import { contentEntities, listConfig, resolveContentEntity, sanitizeContentPayload } from "../../../site-content/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const { filters, config } = listConfig(req.query as Record<string, unknown>)
  const [items, count] = await service[contentEntities[entity].list](filters, config)
  res.json({ items, count, limit: config.take, offset: config.skip })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const payload = sanitizeContentPayload(entity, req.body)
  if (payload.status === "published" && !payload.published_at) payload.published_at = new Date()
  const item = await service[contentEntities[entity].create](payload)
  res.status(201).json({ item })
}
