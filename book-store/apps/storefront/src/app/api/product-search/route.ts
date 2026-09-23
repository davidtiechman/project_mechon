import { MIN_STORE_SEARCH_LENGTH } from "@lib/constants/store"
import { searchProductCatalog } from "@lib/data/product-search"
import { getProductPrice } from "@lib/util/get-product-price"
import { resolveMediaUrl } from "@lib/util/resolve-media-url"
import { normalizeProductSearchText } from "@lib/util/product-search"
import { NextRequest, NextResponse } from "next/server"

const RESULT_LIMIT = 6

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || ""
  const countryCode = request.nextUrl.searchParams.get("countryCode") || ""

  if (normalizeProductSearchText(query).length < MIN_STORE_SEARCH_LENGTH || !/^[a-z]{2}$/i.test(countryCode)) {
    return NextResponse.json({ results: [], total: 0 })
  }

  try {
    const { products: matches } = await searchProductCatalog({
      countryCode,
      query,
    })

    return NextResponse.json({
      total: matches.length,
      results: matches.slice(0, RESULT_LIMIT).map((product) => {
        const variant = product.variants?.[0]
        const price = getProductPrice({ product }).cheapestPrice?.calculated_price || null
        const details = [
          product.subtitle,
          variant?.title && variant.title !== "Default variant" ? variant.title : null,
          ...(variant?.options?.map((option) => option.value) || []),
        ].filter(Boolean)

        return {
          id: product.id,
          handle: product.handle,
          title: product.title,
          details: Array.from(new Set(details)).join(" · "),
          thumbnail: resolveMediaUrl(product.thumbnail || product.images?.[0]?.url),
          price,
        }
      }),
    })
  } catch (error) {
    console.error("Global product search failed", error)
    return NextResponse.json({ results: [], total: 0, error: "search_failed" }, { status: 500 })
  }
}
