import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadInstallmentPolicy } from "../../../../lib/nedarim-installments"

// Public, display-only copy of the owner's rule. The payment route enforces it again.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ policy: await loadInstallmentPolicy(req.scope) })
}
