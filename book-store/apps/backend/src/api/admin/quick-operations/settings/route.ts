import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadQuickSettings } from "./data"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await loadQuickSettings(req.scope))
}
