import { authenticate, defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/site-content/*",
      middlewares: [authenticate("user", ["session", "bearer", "api-key"])],
    },
  ],
})
