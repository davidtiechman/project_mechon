import { HttpTypes } from "@medusajs/types"
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products"

export const getProductSortPrice = (
  product: HttpTypes.StoreProduct
): number | null => {
  const prices = (product.variants || [])
    .map((variant) => variant.calculated_price?.calculated_amount)
    .filter(
      (price): price is number =>
        typeof price === "number" && Number.isFinite(price) && price >= 0
    )

  return prices.length ? Math.min(...prices) : null
}

const compareIds = (
  a: HttpTypes.StoreProduct,
  b: HttpTypes.StoreProduct
) => a.id.localeCompare(b.id)

const getCreatedAt = (product: HttpTypes.StoreProduct) => {
  const timestamp = product.created_at
    ? new Date(product.created_at).getTime()
    : 0

  return Number.isFinite(timestamp) ? timestamp : 0
}

const comparePrices = (
  a: HttpTypes.StoreProduct,
  b: HttpTypes.StoreProduct,
  direction: "asc" | "desc"
) => {
  const aPrice = getProductSortPrice(a)
  const bPrice = getProductSortPrice(b)

  if (aPrice === null && bPrice === null) return 0
  if (aPrice === null) return 1
  if (bPrice === null) return -1

  return direction === "asc" ? aPrice - bPrice : bPrice - aPrice
}

/**
 * Helper function to sort products by price until the store API supports sorting by price
 * @param products
 * @param sortBy
 * @returns products sorted by price
 */
export function sortProducts(
  products: HttpTypes.StoreProduct[],
  sortBy: SortOptions
): HttpTypes.StoreProduct[] {
  return [...products].sort((a, b) => {
    const createdDiff = getCreatedAt(b) - getCreatedAt(a)
    const priceAscDiff = comparePrices(a, b, "asc")

    if (sortBy === "created_at") {
      return createdDiff || priceAscDiff || compareIds(a, b)
    }

    if (sortBy === "created_at_asc") {
      return -createdDiff || priceAscDiff || compareIds(a, b)
    }

    const priceDiff = comparePrices(
      a,
      b,
      sortBy === "price_asc" ? "asc" : "desc"
    )

    return priceDiff || createdDiff || compareIds(a, b)
  })
}
