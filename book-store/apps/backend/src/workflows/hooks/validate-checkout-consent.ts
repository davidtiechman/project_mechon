import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateCheckoutConsent } from "../../lib/checkout-consent"

// Runs inside cart completion, before order creation. Medusa copies the validated
// cart metadata into the order, so consent is recorded with the order atomically.
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // An already completed cart may be retried after a later policy revision.
  if (cart.completed_at) return
  const config = container.resolve("configModule")
  validateCheckoutConsent(cart.id, cart.metadata?.checkout_consent, config.projectConfig.http.jwtSecret)
})
