import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { AuthenticationInput, IAuthModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

type Body = { current_password?: string; new_password: string }

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "auth_identity",
    fields: ["provider_identities.provider"],
    filters: { id: req.auth_context.auth_identity_id },
  })
  const has_password = data[0]?.provider_identities?.some((item) => item?.provider === "emailpass") ?? false
  return res.status(200).json({ has_password })
}

export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const query = req.scope.resolve("query")
  const { data: identities } = await query.graph({
    entity: "auth_identity",
    fields: ["id", "provider_identities.provider", "provider_identities.entity_id", "provider_identities.user_metadata"],
    filters: { id: req.auth_context.auth_identity_id },
  })
  const identity = identities[0]
  const providers = identity?.provider_identities ?? []
  const emailIdentity = providers.find((item) => item?.provider === "emailpass")
  const fallback = providers.find((item) => item?.entity_id?.includes("@") || typeof item?.user_metadata?.email === "string")
  const fallbackEmail = fallback?.entity_id?.includes("@") ? fallback.entity_id : fallback?.user_metadata?.email
  const rawEmail = emailIdentity?.entity_id ?? fallbackEmail
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined
  if (!identity || !email) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")

  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  if (emailIdentity) {
    if (!req.body.current_password) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Current password is required")
    const verified = await auth.authenticate("emailpass", {
      actor_type: "customer", url: req.url, headers: req.headers, query: req.query,
      body: { email, password: req.body.current_password }, protocol: req.protocol,
    } as unknown as AuthenticationInput)
    if (!verified.success || verified.authIdentity?.id !== identity.id) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Current password is incorrect")
    }
  } else {
    await auth.createProviderIdentities({
      provider: "emailpass", entity_id: email, auth_identity_id: identity.id,
      provider_metadata: {}, user_metadata: { email },
    })
  }

  const updated = await auth.updateProvider("emailpass", { entity_id: email, password: req.body.new_password })
  if (!updated.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, updated.error ?? "Password update failed")
  return res.status(200).json({ success: true, mode: emailIdentity ? "changed" : "set" })
}
