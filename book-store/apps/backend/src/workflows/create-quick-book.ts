import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryItemsWorkflow, createInventoryLevelsWorkflow, createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import type { QuickBook } from "../shared/quick-book"
import { SITE_CONTENT_MODULE } from "../modules/site-content"

type Input = { book: QuickBook; productId: string; fingerprint: string }

export function inventoryLevelsInput(book: QuickBook, inventory: { id: string }[]) {
  return book.manage_inventory ? book.variants.flatMap((v, i) => v.stock.map((s) => ({
    inventory_item_id: inventory[i].id, location_id: s.location_id, stocked_quantity: s.quantity,
  }))) : []
}

const quickBookLinkBrand = createStep("quick-book-link-brand", async (input: { brandId: string; productId: string }, { container }) => {
  if (!input.brandId) return new StepResponse(null, null)
  const link = { [SITE_CONTENT_MODULE]: { brand_id: input.brandId }, [Modules.PRODUCT]: { product_id: input.productId } }
  await container.resolve(ContainerRegistrationKeys.LINK).create(link)
  return new StepResponse(input.productId, link)
}, async (link, { container }) => {
  if (link) await container.resolve(ContainerRegistrationKeys.LINK).dismiss(link)
})

export function productInput(book: QuickBook, productId: string, fingerprint: string, inventories: { id: string }[]): CreateProductWorkflowInputDTO {
  // Option titles are persisted catalog data. They never depend on the Admin language.
  const binding = book.variants.some((v) => v.binding)
  return {
    id: productId, title: book.title, description: book.description, handle: book.handle, status: "draft",
    thumbnail: book.images[0], images: book.images.map((url) => ({ url })),
    collection_id: book.collection_id || undefined, category_ids: book.category_ids,
    shipping_profile_id: book.shipping_profile_id, sales_channels: [{ id: book.sales_channel_id }],
    metadata: { quick_book_fingerprint: fingerprint, quick_book_complete: false },
    options: [{ title: "Size", values: [...new Set(book.variants.map((v) => v.size))] },
      ...(binding ? [{ title: "Binding", values: [...new Set(book.variants.map((v) => v.binding))] }] : [])],
    variants: book.variants.map((v, i) => ({
      title: [v.size, v.binding].filter(Boolean).join(" / "), sku: v.sku,
      manage_inventory: book.manage_inventory, allow_backorder: book.allow_backorder,
      options: { Size: v.size, ...(binding ? { Binding: v.binding } : {}) },
      prices: [{ amount: v.price, currency_code: book.currency_code }],
      inventory_items: book.manage_inventory ? [{ inventory_item_id: inventories[i].id, required_quantity: 1 }] : [],
    })),
  }
}

export const createQuickBookWorkflow = createWorkflow("create-quick-book", (input: Input) => {
  const inventory = createInventoryItemsWorkflow.runAsStep({ input: {
    items: transform(input, ({ book }) => book.manage_inventory ? book.variants.map((v) => ({ sku: v.sku, title: v.sku, requires_shipping: true })) : []),
  } })
  const products = createProductsWorkflow.runAsStep({ input: {
    products: transform({ input, inventory }, ({ input, inventory }) => [productInput(input.book, input.productId, input.fingerprint, inventory)]),
  } })
  const levels = createInventoryLevelsWorkflow.runAsStep({ input: {
    inventory_levels: transform({ input, inventory, products }, ({ input, inventory }) => inventoryLevelsInput(input.book, inventory)),
  } })
  const brand = quickBookLinkBrand(transform({ input, products }, ({ input }) => ({ brandId: input.book.brand_id, productId: input.productId })))
  // Explicit dependencies: publication is the final step, after stock and brand links.
  const final = updateProductsWorkflow.runAsStep({ input: transform({ input, levels, brand }, ({ input }) => ({
    products: [{ id: input.productId, status: input.book.status, metadata: { quick_book_fingerprint: input.fingerprint, quick_book_complete: true } }],
  })) })
  return new WorkflowResponse(final)
})
