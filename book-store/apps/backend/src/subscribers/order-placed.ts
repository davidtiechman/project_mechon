import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { CreateNotificationDTO, Logger } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve<Logger>("logger")

  try {
    const query = container.resolve("query")
    const notificationService = container.resolve(Modules.NOTIFICATION)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "currency_code", "total", "shipping_total",
        "items.*", "shipping_address.*", "shipping_methods.*", "customer.*",
      ],
      filters: { id: data.id },
    })
    const order = orders[0]
    if (!order) throw new Error(`Order ${data.id} was not found`)

    const customerName = [
      order.customer?.first_name ?? order.shipping_address?.first_name,
      order.customer?.last_name ?? order.shipping_address?.last_name,
    ].filter(Boolean).join(" ")
    const emailData = {
      display_id: order.display_id,
      email: order.email,
      customer_name: customerName,
      phone: order.shipping_address?.phone ?? order.customer?.phone,
      currency_code: order.currency_code,
      items: order.items,
      shipping_address: order.shipping_address,
      shipping_methods: order.shipping_methods,
      shipping_total: order.shipping_total,
      total: order.total,
    }
    const notifications: CreateNotificationDTO[] = []

    if (order.email) notifications.push({
      to: order.email,
      channel: "email",
      template: "order-customer",
      data: emailData,
      trigger_type: "order.placed",
      resource_type: "order",
      resource_id: order.id,
      receiver_id: order.customer?.id,
      idempotency_key: `order-placed:${order.id}:customer`,
    })

    if (process.env.ORDER_NOTIFICATION_EMAIL) notifications.push({
      to: process.env.ORDER_NOTIFICATION_EMAIL,
      channel: "email",
      template: "order-owner",
      data: emailData,
      trigger_type: "order.placed",
      resource_type: "order",
      resource_id: order.id,
      idempotency_key: `order-placed:${order.id}:owner`,
    })
    else logger.warn("[email] ORDER_NOTIFICATION_EMAIL is not configured; owner notification skipped")

    if (notifications.length) await notificationService.createNotifications(notifications)
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    logger.error(`[email] Order ${data.id} completed, but email notifications failed: ${message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
