"use client"

import { DEFAULT_STORE_SEARCH_DEBOUNCE_MS } from "@lib/constants/store"
import {
  OPTION_VALUE_QUERY_KEY,
  type OptionValueIds,
} from "@lib/util/product-option-filters"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"
import OptionsPicker from "@modules/store/components/refinement-list/options-picker"
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

const debounceEnvValue = process.env.NEXT_PUBLIC_STORE_SEARCH_DEBOUNCE_MS
const rawDebounce =
  debounceEnvValue?.trim() === "" ? Number.NaN : Number(debounceEnvValue)
const SEARCH_DEBOUNCE_MS =
  Number.isFinite(rawDebounce) && rawDebounce >= 0
    ? rawDebounce
    : DEFAULT_STORE_SEARCH_DEBOUNCE_MS

const validSorts: SortOptions[] = [
  "created_at",
  "created_at_asc",
  "price_asc",
  "price_desc",
]

const normalizeSort = (value: string | null): SortOptions =>
  validSorts.includes(value as SortOptions)
    ? (value as SortOptions)
    : "created_at"

const normalizeSearchText = (value: string) =>
  value.trim().toLocaleLowerCase("he")

const getSearchableText = (product: HttpTypes.StoreProduct) =>
  [
    product.title,
    product.subtitle,
    product.collection?.title,
    ...(product.tags?.map((tag) => tag.value) || []),
    ...(product.categories?.map((category) => category.name) || []),
    ...Object.values(product.metadata || {}).map(String),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("he")

const updateBrowserUrl = (
  changes: Record<string, string | null>,
  mode: "push" | "replace"
) => {
  const url = new URL(window.location.href)

  Object.entries(changes).forEach(([key, value]) => {
    if (!value || (key === "page" && value === "1")) {
      url.searchParams.delete(key)
    } else {
      url.searchParams.set(key, value)
    }
  })

  window.history[mode === "push" ? "pushState" : "replaceState"](
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  )
}

export default function ProductBrowser({
  allProducts,
  region,
  productsPerPage,
  initialSearch,
  initialSort,
  initialPage,
  selectedOptionValueIds,
}: {
  allProducts: HttpTypes.StoreProduct[]
  region: HttpTypes.StoreRegion
  productsPerPage: number
  initialSearch: string
  initialSort: SortOptions
  initialPage: number
  selectedOptionValueIds: OptionValueIds
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [sortBy, setSortBy] = useState<SortOptions>(normalizeSort(initialSort))
  const [page, setPage] = useState(Math.max(initialPage, 1))

  useEffect(() => {
    if (searchInput === debouncedSearch) {
      return
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [debouncedSearch, searchInput])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const restoredSearch = params.get("search") || ""
      const restoredPage = Number.parseInt(params.get("page") || "1", 10)

      setSearchInput(restoredSearch)
      setDebouncedSearch(restoredSearch)
      setSortBy(normalizeSort(params.get("sortBy")))
      setPage(Number.isFinite(restoredPage) && restoredPage > 0 ? restoredPage : 1)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const filteredAndSortedProducts = useMemo(() => {
    const search = normalizeSearchText(debouncedSearch)
    const filtered = search
      ? allProducts.filter((product) => getSearchableText(product).includes(search))
      : allProducts

    return sortProducts(filtered, sortBy)
  }, [allProducts, debouncedSearch, sortBy])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedProducts.length / productsPerPage)
  )
  const safePage = Math.min(page, totalPages)
  const visibleProducts = filteredAndSortedProducts.slice(
    (safePage - 1) * productsPerPage,
    safePage * productsPerPage
  )

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage)
      updateBrowserUrl({ page: safePage === 1 ? null : String(safePage) }, "replace")
    }
  }, [page, safePage])

  const changeSort = (value: SortOptions) => {
    setSortBy(value)
    setPage(1)
    updateBrowserUrl({ sortBy: value, page: null }, "push")
  }

  const changePage = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages)
    setPage(boundedPage)
    updateBrowserUrl(
      { page: boundedPage === 1 ? null : String(boundedPage) },
      "push"
    )
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const setOptionValueIds = useCallback(
    (valueIds: string[]) => {
      const params = new URLSearchParams(window.location.search)
      params.delete(OPTION_VALUE_QUERY_KEY)
      params.delete("page")
      valueIds.forEach((valueId) => params.append(OPTION_VALUE_QUERY_KEY, valueId))
      router.push(params.size ? `${pathname}?${params}` : pathname)
    },
    [pathname, router]
  )

  return (
    <div className="flex w-full flex-col gap-8 small:flex-row small:items-start">
      <aside className="flex w-full flex-col gap-6 small:w-[250px] small:shrink-0">
        <div>
          <label htmlFor="store-search" className="mb-2 block text-sm font-medium text-[#51463a]">
            חיפוש ספרים
          </label>
          <input
            id="store-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="הקלידו שם ספר"
            autoComplete="off"
            className="h-11 w-full rounded-md border border-[#d6c8ba] bg-white px-3 text-right outline-none transition focus:border-[#8a6f4d] focus:ring-2 focus:ring-[#8a6f4d]/20"
          />
        </div>
        <div>
          <label htmlFor="store-sort" className="mb-2 block text-sm font-medium text-[#51463a]">
            מיון לפי
          </label>
          <select
            id="store-sort"
            value={sortBy}
            onChange={(event) => changeSort(event.target.value as SortOptions)}
            className="h-11 w-full rounded-md border border-[#d6c8ba] bg-white px-3 text-right outline-none focus:border-[#8a6f4d] focus:ring-2 focus:ring-[#8a6f4d]/20"
          >
            <option value="created_at">החדשים ביותר</option>
            <option value="created_at_asc">הישנים ביותר</option>
            <option value="price_asc">מחיר: מהנמוך לגבוה</option>
            <option value="price_desc">מחיר: מהגבוה לנמוך</option>
          </select>
        </div>
        <OptionsPicker
          selectedValueIds={selectedOptionValueIds}
          setOptionValueIds={setOptionValueIds}
        />
      </aside>

      <div className="min-w-0 flex-1">
        {visibleProducts.length ? (
          <ul
            className="grid w-full grid-cols-2 gap-x-5 gap-y-12 small:grid-cols-3 small:gap-x-8 small:gap-y-16 medium:grid-cols-4"
            data-testid="products-list"
          >
            {visibleProducts.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-[#e0d2c5] bg-[#faf6f1] p-8 text-center text-[#51463a]">
            לא נמצאו ספרים המתאימים לחיפוש.
          </p>
        )}

        {filteredAndSortedProducts.length > productsPerPage && (
          <nav aria-label="עמודי תוצאות" className="mt-12 flex justify-center gap-3">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  aria-current={pageNumber === safePage ? "page" : undefined}
                  onClick={() => changePage(pageNumber)}
                  className={`h-10 min-w-10 rounded-md px-3 transition-colors ${
                    pageNumber === safePage
                      ? "bg-[#6b5339] text-white"
                      : "border border-[#d6c8ba] bg-white text-[#51463a] hover:bg-[#f3ebe3]"
                  }`}
                >
                  {pageNumber}
                </button>
              )
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
