import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function testResendEmail({ container }: { container: MedusaContainer }) {
  const recipient = process.env.TEST_EMAIL_RECIPIENT
  if (!recipient) {
    throw new Error("Set TEST_EMAIL_RECIPIENT before running the Resend test script.")
  }

  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: recipient,
    channel: "email",
    template: "order-customer",
    data: {
      display_id: "TEST",
      customer_name: "לקוח לבדיקה",
      currency_code: "ILS",
      items: [
        {
          id: "test-item",
          product_title: "מוצר לדוגמה",
          variant_title: "מהדורת בדיקה",
          quantity: 1,
          total: 49.9,
        },
      ],
      shipping_total: 20,
      total: 69.9,
      shipping_address: {
        first_name: "לקוח",
        last_name: "לבדיקה",
        address_1: "רחוב לדוגמה 1",
        city: "ירושלים",
        country_code: "IL",
      },
    },
    trigger_type: "manual.resend_test",
    idempotency_key: `manual-resend-test:${Date.now()}`,
  })
}
