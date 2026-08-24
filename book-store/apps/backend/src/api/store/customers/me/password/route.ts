import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { AuthenticationInput, IAuthModuleService } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"

type Body = { current_password?: string; new_password: string }

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  if (!customerId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "המשתמש אינו מחובר")

  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "auth_identity",
    fields: ["id", "provider_identities.provider"],
    filters: { app_metadata: { customer_id: customerId } } as never,
  })
  const has_password = data.some((identity) =>
    identity.provider_identities?.some((item) => item?.provider === "emailpass")
  )
  const authenticatedWithOtp = data
    .find((identity) => identity.id === req.auth_context.auth_identity_id)
    ?.provider_identities?.some((item) => item?.provider === "emailotp") ?? false

  return res.status(200).json({
    has_password,
    requires_current_password: has_password && !authenticatedWithOtp,
  })
}

export const POST = async (req: AuthenticatedMedusaRequest<Body>, res: MedusaResponse) => {
  const customerId = req.auth_context.actor_id
  if (!customerId) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "המשתמש אינו מחובר")

  const query = req.scope.resolve("query")
  const { data: identities } = await query.graph({
    entity: "auth_identity",
    fields: ["id", "provider_identities.provider", "provider_identities.entity_id", "provider_identities.user_metadata"],
    filters: { app_metadata: { customer_id: customerId } } as never,
  })
  const currentIdentity = identities.find(
    (identity) => identity.id === req.auth_context.auth_identity_id
  )
  const emailIdentityOwner = identities.find((identity) =>
    identity.provider_identities?.some((item) => item?.provider === "emailpass")
  )
  const emailIdentity = emailIdentityOwner?.provider_identities?.find(
    (item) => item?.provider === "emailpass"
  )
  const authenticatedWithOtp = currentIdentity?.provider_identities?.some(
    (item) => item?.provider === "emailotp"
  ) ?? false
  const providers = identities.flatMap((identity) => identity.provider_identities ?? [])
  const fallback = providers.find((item) => item?.entity_id?.includes("@") || typeof item?.user_metadata?.email === "string")
  const fallbackEmail = fallback?.entity_id?.includes("@") ? fallback.entity_id : fallback?.user_metadata?.email
  const rawEmail = emailIdentity?.entity_id ?? fallbackEmail
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : undefined
  if (!currentIdentity || !email) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "המשתמש אינו מחובר")

  const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  if (emailIdentity && !authenticatedWithOtp) {
    if (!req.body.current_password) throw new MedusaError(MedusaError.Types.INVALID_DATA, "יש להזין את הסיסמה הנוכחית")
    const verified = await auth.authenticate("emailpass", {
      actor_type: "customer", url: req.url, headers: req.headers, query: req.query,
      body: { email, password: req.body.current_password }, protocol: req.protocol,
    } as unknown as AuthenticationInput)
    if (!verified.success || verified.authIdentity?.id !== emailIdentityOwner?.id) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "הסיסמה הנוכחית שגויה")
    }
  } else if (!emailIdentity) {
    await auth.createProviderIdentities({
      provider: "emailpass", entity_id: email, auth_identity_id: currentIdentity.id,
      provider_metadata: {}, user_metadata: { email },
    })
  }

  const updated = await auth.updateProvider("emailpass", { entity_id: email, password: req.body.new_password })
  if (!updated.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, "עדכון הסיסמה נכשל")
  return res.status(200).json({ success: true, mode: emailIdentity ? "changed" : "set" })
}
