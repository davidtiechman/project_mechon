import "server-only"

import { HttpTypes } from "@medusajs/types"
import { getLocale } from "./locale-actions"
import { listAllProducts } from "./products"
import { listContent } from "./site-content"
import { scoreProductSearch } from "@lib/util/product-search"

const SEARCH_DATASET_TTL_MS = 60_000

type SearchDataset = {
  products: HttpTypes.StoreProduct[]
  extraSearchTerms: Record<string, string[]>
}

type SearchDatasetCacheEntry = {
  expiresAt: number
  value: Promise<SearchDataset>
}

const globalSearchCache = globalThis as typeof globalThis & {
  __productSearchDatasets?: Map<string, SearchDatasetCacheEntry>
}

const searchDatasetCache =
  globalSearchCache.__productSearchDatasets ||
  (globalSearchCache.__productSearchDatasets = new Map())

async function loadSearchDataset(
  countryCode: string,
  optionValueIds: string[]
): Promise<SearchDataset> {
  const [products, brands] = await Promise.all([
    listAllProducts({
      countryCode,
      queryParams: optionValueIds.length
        ? { option_value_id: optionValueIds }
        : undefined,
    }),
    listContent("brands"),
  ])
  const extraSearchTerms = brands.reduce<Record<string, string[]>>(
    (terms, brand) => {
      brand.products?.forEach((product) => {
        terms[product.id] = [
          ...(terms[product.id] || []),
          brand.name || "",
          brand.title || "",
        ]
      })
      return terms
    },
    {}
  )

  return { products, extraSearchTerms }
}

async function getSearchDataset(
  countryCode: string,
  optionValueIds: string[]
): Promise<SearchDataset> {
  const locale = (await getLocale()) || "default"
  const sortedOptionIds = [...optionValueIds].sort()
  const cacheKey = [countryCode, locale, ...sortedOptionIds].join(":")
  const now = Date.now()
  const cached = searchDatasetCache.get(cacheKey)

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const value = loadSearchDataset(countryCode, sortedOptionIds)
  searchDatasetCache.set(cacheKey, {
    expiresAt: now + SEARCH_DATASET_TTL_MS,
    value,
  })

  try {
    return await value
  } catch (error) {
    if (searchDatasetCache.get(cacheKey)?.value === value) {
      searchDatasetCache.delete(cacheKey)
    }
    throw error
  }
}

export async function searchProductCatalog({
  countryCode,
  query,
  optionValueIds = [],
}: {
  countryCode: string
  query: string
  optionValueIds?: string[]
}): Promise<{
  products: HttpTypes.StoreProduct[]
  extraSearchTerms: Record<string, string[]>
}> {
  const { products, extraSearchTerms } = await getSearchDataset(
    countryCode,
    optionValueIds
  )

  return {
    products: products
      .map((product) => ({
        product,
        score: scoreProductSearch(
          product,
          query,
          extraSearchTerms[product.id]
        ),
      }))
      .filter(({ score }) => score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.product.title.localeCompare(b.product.title, "he")
      )
      .map(({ product }) => product),
    extraSearchTerms,
  }
}
