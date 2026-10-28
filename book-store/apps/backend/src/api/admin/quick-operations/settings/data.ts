import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { QuickSettings } from "../../../../shared/quick-book"

// Every graph query is paginated, including installations with >100 records.
export async function loadQuickSettings(scope: MedusaContainer): Promise<QuickSettings> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  async function all(entity: string, fields: string[]) {
    const rows: any[] = []
    for (let skip = 0; ; skip += 100) {
      const { data, metadata } = await query.graph({ entity, fields, pagination: { skip, take: 100, order: { id: "ASC" } } })
      rows.push(...data)
      if (data.length < 100 || (metadata?.count !== undefined && rows.length >= metadata.count)) return rows
    }
  }
  const [locations, channels, profiles, categories, collections, brands, stores, shipping] = await Promise.all([
    all("stock_location", ["id", "name", "sales_channels.id", "fulfillment_sets.id"]),
    all("sales_channel", ["id", "name"]), all("shipping_profile", ["id", "name"]),
    all("product_category", ["id", "name"]), all("product_collection", ["id", "title"]),
    all("brand", ["id", "name"]), all("store", ["id", "supported_currencies.currency_code"]),
    all("shipping_option", ["id", "shipping_profile_id", "service_zone.fulfillment_set_id"]),
  ])
  return { locations, channels, profiles, categories, collections: collections.map((c) => ({ id: c.id, name: c.title })), brands,
    currencies: [...new Set<string>(stores.flatMap((s) => s.supported_currencies.map((c: any) => c.currency_code)))], shipping }
}
