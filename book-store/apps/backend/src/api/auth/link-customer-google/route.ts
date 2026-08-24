import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { linkGoogleCustomerIdentityWorkflow } from "../../../workflows/link-google-customer-identity"

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  if (req.auth_context.actor_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Auth identity is already linked to a customer."
    )
  }

  const { result } = await linkGoogleCustomerIdentityWorkflow(req.scope).run({
    input: { auth_identity_id: req.auth_context.auth_identity_id },
  })

  res.status(200).json(result)
}
