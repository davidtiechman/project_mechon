import { z } from "zod"

export const quickBookSchema = z.object({
  request_id: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20000),
  handle: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(255),
  status: z.enum(["draft", "published"]),
  images: z.array(z.string().url()).max(20),
  brand_id: z.string(),
  category_ids: z.array(z.string()).max(100),
  collection_id: z.string(),
  sales_channel_id: z.string().min(1),
  shipping_profile_id: z.string().min(1),
  currency_code: z.string().length(3),
  manage_inventory: z.boolean(),
  allow_backorder: z.boolean(),
  variants: z.array(z.object({
    size: z.string().trim().min(1).max(100),
    binding: z.string().trim().max(100),
    sku: z.string().trim().min(1).max(100),
    price: z.number().finite().nonnegative(),
    stock: z.array(z.object({ location_id: z.string().min(1), quantity: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })).min(1).max(100),
  })).min(1).max(100),
}).superRefine((book, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message })
  if (book.status === "published" && !book.images.length) issue(["images"], "coverRequired")
  const combinations = new Set<string>(), skus = new Set<string>()
  const binding = book.variants.some((v) => v.binding)
  book.variants.forEach((v, i) => {
    const key = JSON.stringify([v.size.toLowerCase(), v.binding.toLowerCase()])
    if (combinations.has(key)) issue(["variants", i, "size"], "duplicateOptions")
    if (skus.has(v.sku.toLowerCase())) issue(["variants", i, "sku"], "duplicateSku")
    if (binding && !v.binding) issue(["variants", i, "binding"], "required")
    if (new Set(v.stock.map((s) => s.location_id)).size !== v.stock.length) issue(["variants", i, "stock"], "duplicateLocation")
    combinations.add(key); skus.add(v.sku.toLowerCase())
  })
})

export type QuickBook = z.infer<typeof quickBookSchema>
export type Choice = { id: string; name: string }
export type QuickSettings = {
  locations: (Choice & { sales_channels: { id: string }[]; fulfillment_sets: { id: string }[] })[]
  channels: Choice[]; profiles: Choice[]; categories: Choice[]; collections: Choice[]; brands: Choice[]
  currencies: string[]
  shipping: { id: string; shipping_profile_id: string; service_zone: { fulfillment_set_id: string } }[]
}

export function shippingWarnings(book: Pick<QuickBook, "variants" | "sales_channel_id" | "shipping_profile_id">, settings: QuickSettings) {
  const locations = new Set(book.variants.flatMap((v) => v.stock.map((s) => s.location_id)))
  return [...locations].flatMap((id) => {
    const location = settings.locations.find((l) => l.id === id)
    if (!location) return ["staleSettings"]
    const warnings: string[] = []
    if (!location.sales_channels.some((c) => c.id === book.sales_channel_id)) warnings.push("channelMismatch")
    if (!settings.shipping.some((s) => s.shipping_profile_id === book.shipping_profile_id && location.fulfillment_sets.some((f) => f.id === s.service_zone?.fulfillment_set_id))) warnings.push("shippingMismatch")
    return warnings
  })
}
