import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadInstallmentPolicy, loadWallets } from "../../../../lib/nedarim-installments"

// Public, display-only copy of the owner's payment options. The payment route enforces them.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [policy, wallets] = await Promise.all([loadInstallmentPolicy(req.scope), loadWallets(req.scope)])
  res.json({ policy, wallets })
}
