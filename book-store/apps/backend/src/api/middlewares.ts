import { authenticate, defineMiddlewares, validateAndTransformBody, type MedusaRequest, type MedusaResponse, type MedusaNextFunction } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

function protectMarketingMetadata(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const metadata = (req.body as { metadata?: Record<string, unknown> })?.metadata
  if (metadata && Object.prototype.hasOwnProperty.call(metadata, "marketing_consent")) {
    return res.status(400).json({ message: "יש לעדכן את בחירת הדיוור דרך הגדרות הדיוור." })
  }
  next()
}

export default defineMiddlewares({
  routes: [
    ...["/store/customers", "/store/customers/me", "/store/carts", "/store/carts/:id"].map((matcher) => ({
      matcher, method: "POST" as const, middlewares: [protectMarketingMetadata],
    })),
    {
      matcher: "/store/customers/me/marketing-consent",
      methods: ["GET", "POST"],
      middlewares: [authenticate("customer", ["bearer"])],
    },
    {
      matcher: "/store/auth/email-otp/request",
      method: "POST",
      middlewares: [validateAndTransformBody(z.object({ email: z.string().email().max(320) }))],
    },
    {
      matcher: "/store/customers/me/password",
      methods: ["GET", "POST"],
      middlewares: [
        authenticate("customer", ["bearer"]),
      ],
    },
    {
      matcher: "/store/customers/me/checkout-profile",
      method: "POST",
      middlewares: [
        authenticate("customer", ["bearer"]),
        validateAndTransformBody(z.object({
          source_type: z.enum(["cart", "order"]),
          source_id: z.string().min(1),
        })),
      ],
    },
    {
      matcher: "/store/customers/me/password",
      method: "POST",
      middlewares: [validateAndTransformBody(z.object({
        current_password: z.string().optional(),
        new_password: z.string().min(8).max(128),
      }))],
    },
    {
      matcher: "/admin/site-content/*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
    {
      matcher: "/auth/link-customer-google",
      method: "POST",
      middlewares: [
        authenticate("customer", ["bearer"], { allowUnregistered: true }),
      ],
    },
  ],
})
