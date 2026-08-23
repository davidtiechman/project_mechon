import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

type ResetEvent = { entity_id: string; actor_type: string; token: string }

export default async function adminPasswordResetHandler({ event: { data }, container }: SubscriberArgs<ResetEvent>) {
  if (data.actor_type !== "user") return
  const logger = container.resolve<Logger>("logger")
  try {
    const config = container.resolve("configModule")
    const backendUrl = config.admin.backendUrl !== "/" ? config.admin.backendUrl : "http://localhost:9000"
    const adminPath = config.admin.path || "/app"
    const params = new URLSearchParams({ token: data.token, email: data.entity_id })
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: data.entity_id,
      channel: "email",
      template: "admin-password-reset",
      data: { reset_url: `${backendUrl}${adminPath}/reset-password?${params}` },
      trigger_type: "auth.password_reset",
      resource_type: "user",
      idempotency_key: `admin-password-reset:${data.token}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    logger.error(`[email] Admin password-reset email failed for ${data.entity_id}: ${message}`)
  }
}

export const config: SubscriberConfig = { event: "auth.password_reset" }
