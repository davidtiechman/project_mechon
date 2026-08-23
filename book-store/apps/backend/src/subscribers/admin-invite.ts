import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { Logger } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function adminInviteHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>("logger")
  try {
    const query = container.resolve("query")
    const { data: invites } = await query.graph({
      entity: "invite",
      fields: ["id", "email", "token"],
      filters: { id: data.id },
    })
    const invite = invites[0]
    if (!invite) throw new Error(`Invite ${data.id} was not found`)
    const config = container.resolve("configModule")
    const backendUrl = config.admin.backendUrl !== "/" ? config.admin.backendUrl : "http://localhost:9000"
    const adminPath = config.admin.path || "/app"
    const params = new URLSearchParams({ token: invite.token })
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: invite.email,
      channel: "email",
      template: "admin-invite",
      data: { invite_url: `${backendUrl}${adminPath}/invite?${params}` },
      trigger_type: "invite",
      resource_type: "invite",
      resource_id: invite.id,
      idempotency_key: `admin-invite:${invite.id}:${invite.token}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    logger.error(`[email] Admin invite email failed for invite ${data.id}: ${message}`)
  }
}

export const config: SubscriberConfig = { event: ["invite.created", "invite.resent"] }
