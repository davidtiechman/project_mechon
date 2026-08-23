import { listCollections } from "@lib/data/collections"
import { listProducts } from "@lib/data/products"
import { listContent } from "@lib/data/site-content"
import { getBaseURL } from "@lib/util/env"
import {
  getIndexableLocales,
  localizedPath,
  nonIndexablePageSlugs,
} from "@lib/util/seo"
import type { MetadataRoute } from "next"

export const dynamic = "force-dynamic"

async function getProductHandles(countryCode: string) {
  const handles: string[] = []
  let page = 1

  while (page) {
    const { response, nextPage } = await listProducts({
      countryCode,
      pageParam: page,
      queryParams: { fields: "handle", limit: 100 },
    })
    handles.push(
      ...response.products.flatMap((product) =>
        product.handle ? [product.handle] : [],
      ),
    )
    page = nextPage ?? 0
  }

  return handles
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, brands, articles, collectionResult] = await Promise.all([
    listContent("pages"),
    listContent("brands"),
    listContent("articles"),
    listCollections(),
  ])
  const base = getBaseURL().replace(/\/$/, "")
  const countryCodes = getIndexableLocales()
  const entries = await Promise.all(
    countryCodes.map(async (countryCode) => {
      const paths = [
        "",
        "store",
        ...(await getProductHandles(countryCode)).map(
          (handle) => `products/${handle}`,
        ),
        ...collectionResult.collections.flatMap((collection) =>
          collection.handle ? [`collections/${collection.handle}`] : [],
        ),
        ...pages.flatMap((item) =>
          item.slug && !nonIndexablePageSlugs.has(item.slug)
            ? [`pages/${item.slug}`]
            : [],
        ),
        ...brands.flatMap((item) => (item.slug ? [`brands/${item.slug}`] : [])),
        ...articles.flatMap((item) =>
          item.slug ? [`articles/${item.slug}`] : [],
        ),
      ]
      return paths.map((path) => ({
        url: `${base}${localizedPath(countryCode, path)}`,
      }))
    }),
  )

  return Array.from(
    new Map(entries.flat().map((entry) => [entry.url, entry])).values(),
  )
}
