import { PRODUCTS_PER_PAGE, STORE_PRODUCT_FETCH_LIMIT } from "@lib/constants/store"
import { searchProductCatalog } from "@lib/data/product-search"
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

  const normalizedSearch = initialSearch.trim()
  const [region, productData] = await Promise.all([
    getRegion(countryCode),
    normalizedSearch
      ? searchProductCatalog({
          countryCode,
          query: normalizedSearch,
          optionValueIds: optionFilters,
        })
      : listProducts({
          countryCode,
          queryParams: {
            limit: STORE_PRODUCT_FETCH_LIMIT,
            ...(optionFilters.length
              ? { option_value_id: optionFilters }
              : {}),
          },
        }).then(({ response }) => ({
          products: response.products,
          extraSearchTerms: {},
        })),
  ])

  if (!region) {
    return null
  }

  return (
    <ProductBrowser
      allProducts={productData.products}
      extraSearchTerms={productData.extraSearchTerms}
      productsPreFiltered={Boolean(normalizedSearch)}
      region={region}
      productsPerPage={PRODUCTS_PER_PAGE}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialPage={initialPage}
      selectedOptionValueIds={optionFilters}
    />
  )
}
