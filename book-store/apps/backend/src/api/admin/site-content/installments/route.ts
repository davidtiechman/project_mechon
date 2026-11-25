import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadInstallmentPolicy, saveInstallmentPolicy } from "../../../../lib/nedarim-installments"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ policy: await loadInstallmentPolicy(req.scope) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  let policy
  try { policy = await saveInstallmentPolicy(req.scope, req.body) }
  catch (error) {
    if (error instanceof MedusaError) throw error
    throw new MedusaError(MedusaError.Types.INVALID_DATA, error instanceof Error ? error.message : "הגדרות התשלומים אינן תקינות.")
  }
  res.json({ policy })
}
