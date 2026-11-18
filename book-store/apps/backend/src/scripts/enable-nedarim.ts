import type { ExecArgs } from "@medusajs/framework/types"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"
import { nedarimConfig, nedarimEnabled, NEDARIM_PROVIDER_ID } from "../lib/nedarim"

// Run explicitly after deployment: npx medusa exec ./src/scripts/enable-nedarim.ts
export default async function enableNedarim({ container }: ExecArgs) {
  if (!nedarimEnabled()) throw new Error("NEDARIM_MOSAD must be configured and NEDARIM_ENABLED must not be false")
  nedarimConfig()
  const query = container.resolve("query")
  const logger = container.resolve("logger")
  const { data: regions } = await query.graph({ entity: "region", fields: ["id", "currency_code"] })
  for (const region of regions) {
    if (!["ils", "usd"].includes(region.currency_code)) continue
    await updateRegionsWorkflow(container).run({ input: {
      selector: { id: region.id }, update: { payment_providers: [NEDARIM_PROVIDER_ID] },
    } })
    logger.info(`Enabled Nedarim payment provider for region ${region.id}`)
  }
}
