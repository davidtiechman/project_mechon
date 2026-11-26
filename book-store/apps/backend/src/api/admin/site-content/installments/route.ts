import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { loadInstallmentPolicy, loadWallets, savePaymentOptions } from "../../../../lib/nedarim-installments"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [policy, wallets] = await Promise.all([loadInstallmentPolicy(req.scope), loadWallets(req.scope)])
  res.json({ policy, wallets })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try { res.json(await savePaymentOptions(req.scope, req.body)) }
  catch (error) {
    if (error instanceof MedusaError) throw error
    throw new MedusaError(MedusaError.Types.INVALID_DATA, error instanceof Error ? error.message : "הגדרות התשלום אינן תקינות.")
  }
}
