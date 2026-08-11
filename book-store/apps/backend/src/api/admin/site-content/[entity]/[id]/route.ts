import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SITE_CONTENT_MODULE } from "../../../../../modules/site-content"
import { contentEntities, resolveContentEntity, sanitizeContentPayload } from "../../../../site-content/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const item = await service[contentEntities[entity].retrieve](req.params.id)
  res.json({ item })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const payload = sanitizeContentPayload(entity, req.body, true)
  if (payload.status === "published" && !payload.published_at) payload.published_at = new Date()
  const item = await service[contentEntities[entity].update]({ id: req.params.id, ...payload })
  res.json({ item })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const entity = resolveContentEntity(req.params.entity)
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  if (["pages", "brands", "articles"].includes(entity)) {
    const item = await service[contentEntities[entity].update]({ id: req.params.id, status: "archived" })
    return res.json({ item, archived: true })
  }
  await service[contentEntities[entity].remove](req.params.id)
  res.status(204).send()
}
