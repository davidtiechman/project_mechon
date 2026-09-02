import { PRODUCTS_PER_PAGE, STORE_PRODUCT_FETCH_LIMIT } from "@lib/constants/store"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import ProductBrowser from "../components/product-browser"

export default async function StoreProducts({
  countryCode,
  optionValueIds,
  initialSearch,
  initialSort,
  initialPage,
}: {
  countryCode: string
  optionValueIds?: OptionValueIds
  initialSearch: string
  initialSort: SortOptions
  initialPage: number
}) {
  const optionFilters = Array.from(
    new Set((optionValueIds || []).filter(Boolean))
  )

  const [region, productResult] = await Promise.all([
    getRegion(countryCode),
    listProducts({
      countryCode,
      queryParams: {
        limit: STORE_PRODUCT_FETCH_LIMIT,
        ...(optionFilters.length ? { option_value_id: optionFilters } : {}),
      },
    }),
  ])

  if (!region) {
    return null
  }

  return (
    <ProductBrowser
      allProducts={productResult.response.products}
      region={region}
      productsPerPage={PRODUCTS_PER_PAGE}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialPage={initialPage}
      selectedOptionValueIds={optionFilters}
    />
  )
}

