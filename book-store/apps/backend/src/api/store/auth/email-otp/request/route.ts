import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { IAuthModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type EmailOtpModuleService from "../../../../../modules/email-otp/service"

type Body = { email: string }
const PUBLIC_MESSAGE = "If an account exists for this email, a login code has been sent."

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const emailOtp = req.scope.resolve<EmailOtpModuleService>("emailOtp")
  const email = await emailOtp.normalizeEmail(req.body.email ?? "")
  const ip = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown"

  // Apply abuse limits even when the email doesn't exist. Never expose lookup results.
  try {
    await emailOtp.enforceRateLimit(`public-email:${email}`, 5, 60 * 60 * 1000)
    await emailOtp.enforceRateLimit(`public-ip:${ip}`, 20, 60 * 60 * 1000)

    const query = req.scope.resolve("query")
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email"],
      filters: { email },
    })
    if (!customers.length) return res.status(202).json({ message: PUBLIC_MESSAGE })

    const { data: identities } = await query.graph({
      entity: "auth_identity",
      fields: ["id", "provider_identities.id", "provider_identities.provider", "provider_identities.entity_id"],
      filters: { app_metadata: { customer_id: customers[0].id } } as never,
    })
    const identity = identities[0]
    if (!identity) return res.status(202).json({ message: PUBLIC_MESSAGE })

    const auth = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
    const hasOtp = identity.provider_identities?.some((item) =>
      item?.provider === "emailotp" && item.entity_id === email
    )
    if (!hasOtp) {
      await auth.createProviderIdentities({
        provider: "emailotp",
        entity_id: email,
        auth_identity_id: identity.id,
        user_metadata: { email },
      })
    }

    const { code, challenge } = await emailOtp.createChallenge(email, identity.id, ip)
    await req.scope.resolve(Modules.NOTIFICATION).createNotifications({
      to: email,
      channel: "email",
      template: "customer-login-code",
      data: { code, expires_minutes: 10 },
      trigger_type: "auth.email_otp_requested",
      resource_type: "customer",
      resource_id: customers[0].id,
      idempotency_key: `customer-login-code:${challenge.id}`,
    })
  } catch {
    // Deliberately return the same response for missing users, limits, and delivery failures.
  }

  return res.status(202).json({ message: PUBLIC_MESSAGE })
}
