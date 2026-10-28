import { createHash } from "node:crypto"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { quickBookSchema, shippingWarnings } from "../../../../shared/quick-book"
import { createQuickBookWorkflow } from "../../../../workflows/create-quick-book"
import { loadQuickSettings } from "../settings/data"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!req.auth_context?.actor_id) return res.status(401).json({ code: "unauthorized" })
  const parsed = quickBookSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code === "custom" ? i.message : "invalid" })) })
  const book = parsed.data
  const productId = `prod_qb_${createHash("sha256").update(`${req.auth_context.actor_id}:${book.request_id}`).digest("hex").slice(0, 32)}`
  const fingerprint = createHash("sha256").update(JSON.stringify(book)).digest("hex")
  const productService = req.scope.resolve(Modules.PRODUCT)
  const find = async () => (await productService.listProducts({ id: productId }))[0]
  try {
    // Medusa's configured Locking Module serializes simultaneous requests.
    return await req.scope.resolve(Modules.LOCKING).execute("quick-book-create", async () => {
      const existing = await find()
      if (existing) {
        if (existing.metadata?.quick_book_fingerprint !== fingerprint) return res.status(409).json({ code: "requestChanged", product_id: productId })
        if (existing.metadata?.quick_book_complete) return res.json({ product: { id: existing.id, title: existing.title } })
        return res.status(409).json({ code: "partial", product_id: productId })
      }
      const settings = await loadQuickSettings(req.scope)
      const has = (rows: { id: string }[], id: string) => rows.some((r) => r.id === id)
      if (!has(settings.channels, book.sales_channel_id) || !has(settings.profiles, book.shipping_profile_id)
        || !settings.currencies.includes(book.currency_code)
        || (book.brand_id && !has(settings.brands, book.brand_id))
        || (book.collection_id && !has(settings.collections, book.collection_id))
        || book.category_ids.some((id) => !has(settings.categories, id))
        || book.variants.some((v) => v.stock.some((s) => !has(settings.locations, s.location_id)))) {
        return res.status(400).json({ code: "staleSettings" })
      }
      const warnings = shippingWarnings(book, settings)
      if (warnings.includes("channelMismatch")) return res.status(400).json({ code: "channelMismatch" })
      const decimals = new Intl.NumberFormat("en", { style: "currency", currency: book.currency_code }).resolvedOptions().maximumFractionDigits ?? 2
      if (book.variants.some((v) => Math.abs(v.price * 10 ** decimals - Math.round(v.price * 10 ** decimals)) > 1e-6)) return res.status(400).json({ code: "pricePrecision" })
      if ((await productService.listProducts({ handle: book.handle })).length) return res.status(409).json({ code: "handleConflict" })
      if ((await productService.listProductVariants({ sku: book.variants.map((v) => v.sku) })).length) return res.status(409).json({ code: "duplicateSku" })
      await createQuickBookWorkflow(req.scope).run({ input: { book, productId, fingerprint } })
      return res.status(201).json({ product: { id: productId, title: book.title } })
    }, { timeout: 30 })
  } catch (error) {
    // Never return provider/database error messages (or credentials) to the browser.
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Quick book failed: ${productId}; ${error instanceof Error ? error.name : "unknown"}`)
    const partial = await find().catch(() => undefined)
    return res.status(500).json({ code: partial ? "partial" : "saveError", ...(partial ? { product_id: productId } : {}) })
  }
}
