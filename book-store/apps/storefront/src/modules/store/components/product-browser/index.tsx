"use client"

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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

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

const StoreSearchInput = ({
  initialSearch,
  onSearchChange,
  onClear,
}: {
  initialSearch: string
  onSearchChange: (value: string) => void
  onClear: () => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialSearch)

  useEffect(() => setValue(initialSearch), [initialSearch])

  return (
    <>
      <div className="group relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a7968]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          id="store-search"
          type="search"
          ref={inputRef}
          value={value}
          onChange={(event) => {
            const nextValue = event.currentTarget.value
            setValue(nextValue)
            onSearchChange(nextValue)
          }}
          placeholder="חיפוש לפי שם ספר..."
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-[#d6c8ba] bg-white py-3 pl-11 pr-11 text-right shadow-sm outline-none transition duration-200 placeholder:text-[#9c8e80] hover:border-[#b7a28d] focus:border-[#8a6f4d] focus:ring-2 focus:ring-[#8a6f4d]/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("")
              onClear()
              inputRef.current?.focus({ preventScroll: true })
            }}
            aria-label="ניקוי החיפוש"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-[#7a6b5c] transition hover:bg-[#f3ebe3] hover:text-[#51463a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6f4d]/30"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    </>
  )
}

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
  const resultsRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const emptyResultsRef = useRef<HTMLParagraphElement>(null)
  const resultCountRef = useRef<HTMLParagraphElement>(null)
  const paginationRef = useRef<HTMLElement>(null)
  const largestResultsHeightRef = useRef(0)
  const currentSearchRef = useRef(initialSearch)
  const [sortBy, setSortBy] = useState<SortOptions>(normalizeSort(initialSort))
  const [page, setPage] = useState(Math.max(initialPage, 1))

  const sortedProducts = useMemo(
    () => sortProducts(allProducts, sortBy),
    [allProducts, sortBy]
  )

  const totalPages = Math.max(
    1,
    Math.ceil(sortedProducts.length / productsPerPage)
  )
  const safePage = Math.min(page, totalPages)

  const showMatchingProducts = useCallback(
    (value: string) => {
      currentSearchRef.current = value
      const query = normalizeSearchText(value)
      const items = gridRef.current?.querySelectorAll<HTMLLIElement>(
        "[data-product-search]"
      )
      let visibleCount = 0

      items?.forEach((item, index) => {
        const matches = query
          ? item.dataset.productSearch?.includes(query) === true
          : index >= (safePage - 1) * productsPerPage &&
            index < safePage * productsPerPage
        item.hidden = !matches
        if (matches) visibleCount += 1
      })

      if (gridRef.current) gridRef.current.hidden = visibleCount === 0
      if (emptyResultsRef.current) emptyResultsRef.current.hidden = visibleCount > 0
      if (resultCountRef.current) {
        resultCountRef.current.textContent = `${
          query ? visibleCount : sortedProducts.length
        } ספרים נמצאו`
      }
      if (paginationRef.current) {
        paginationRef.current.hidden = Boolean(query) || totalPages <= 1
      }

      const results = resultsRef.current
      if (results) {
        largestResultsHeightRef.current = Math.max(
          largestResultsHeightRef.current,
          results.scrollHeight
        )
        results.style.minHeight = `${largestResultsHeightRef.current}px`
      }
    },
    [productsPerPage, safePage, sortedProducts.length, totalPages]
  )

  useLayoutEffect(() => {
    showMatchingProducts(currentSearchRef.current)
  }, [showMatchingProducts, sortedProducts])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const restoredPage = Number.parseInt(params.get("page") || "1", 10)
      setSortBy(normalizeSort(params.get("sortBy")))
      setPage(Number.isFinite(restoredPage) && restoredPage > 0 ? restoredPage : 1)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

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
          <StoreSearchInput
            initialSearch={initialSearch}
            onSearchChange={showMatchingProducts}
            onClear={() => showMatchingProducts("")}
          />
          <p
            ref={resultCountRef}
            className="mt-2 min-h-5 text-sm text-[#75685b]"
            aria-live="polite"
          >
            {`${sortedProducts.length} ספרים נמצאו`}
          </p>
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

      <div ref={resultsRef} className="min-h-[480px] min-w-0 flex-1">
        <ul
          ref={gridRef}
          className="grid w-full grid-cols-2 gap-x-5 gap-y-12 small:grid-cols-3 small:gap-x-8 small:gap-y-16 medium:grid-cols-4"
          data-testid="products-list"
        >
          {sortedProducts.map((product, index) => (
            <li
              key={product.id}
              data-product-search={getSearchableText(product)}
              hidden={
                index < (safePage - 1) * productsPerPage ||
                index >= safePage * productsPerPage
              }
            >
              <ProductPreview product={product} region={region} />
            </li>
          ))}
        </ul>
        <p
          ref={emptyResultsRef}
          hidden
          className="rounded-lg border border-[#e0d2c5] bg-[#faf6f1] p-8 text-center text-[#51463a]"
        >
          לא נמצאו ספרים המתאימים לחיפוש.
        </p>

        {sortedProducts.length > productsPerPage && (
          <nav ref={paginationRef} aria-label="עמודי תוצאות" className="mt-12 flex justify-center gap-3">
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
