import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SITE_CONTENT_MODULE } from "../../../../modules/site-content"

type CatalogPayload = {
  file_key?: string
  file_url?: string
  file_name?: string
  mime_type?: string
}

const getActiveCatalog = async (service: any) => {
  const [catalog] = await service.listCatalogs(
    { active: true },
    { take: 1, order: { updated_at: "DESC" } }
  )
  return catalog || null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  res.json({ catalog: await getActiveCatalog(service) })
}

export async function POST(req: MedusaRequest<CatalogPayload>, res: MedusaResponse) {
  const { file_key, file_url, file_name, mime_type } = req.body
  const isPdf = mime_type === "application/pdf" && file_name?.toLowerCase().endsWith(".pdf")
  if (!file_key || !file_url || !file_name || !isPdf) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only PDF catalog files are allowed")
  }

  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const current = await getActiveCatalog(service)
  if (current) await service.updateCatalogs({ id: current.id, active: false })

  try {
    const catalog = await service.createCatalogs({
      file_key,
      file_url,
      file_name,
      mime_type,
      active: true,
    })
    return res.status(201).json({ catalog })
  } catch (error) {
    if (current) await service.updateCatalogs({ id: current.id, active: true })
    throw error
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(SITE_CONTENT_MODULE) as any
  const current = await getActiveCatalog(service)
  if (current) await service.updateCatalogs({ id: current.id, active: false })
  res.json({ active: false, catalog: null })
}
