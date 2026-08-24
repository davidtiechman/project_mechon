import { authenticate, defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export default defineMiddlewares({
  routes: [
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
