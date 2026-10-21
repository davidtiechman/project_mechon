import "server-only"
import { measurePerformance } from "@lib/observability/performance"

import { getCategoryByHandle } from "./categories"
import { getInstituteProject } from "./institute-projects"
import { getProductTagByValue } from "./product-tags"
import { listProducts } from "./products"
import type { ContentItem } from "./site-content"

const brandProductTags: Record<string, string[]> = {
  "חדשים": ["מוצר חדש"],
  "ספרים חדשים": ["מוצר חדש"],
  "נשים וילדים": ["נשים", "תלמידים"],
  "מזכרות": ["מזכרת"],
}

/** Shared by brand pages and navigation so both use the same catalog membership. */
export async function getBrandProducts(
  item: Pick<ContentItem, "slug" | "title" | "name" | "products">,
  countryCode: string
) {
  return measurePerformance("brand_products.total", async () => {
    const title = (item.title || item.name || "").trim()
    const linkedProductIds = item.products?.map((product) => product.id) || []
    let filter:
      | { tag_id: string[] }
      | { id: string[] }
      | { category_id: string[] }
      | undefined

    const tagValues = brandProductTags[title]
    if (tagValues) {
      const tags = await measurePerformance("brand_products.tag", () =>
        Promise.all(tagValues.map(getProductTagByValue))
      )
      const tagIds = tags.flatMap((tag) => (tag ? [tag.id] : []))
      if (tagIds.length) filter = { tag_id: tagIds }
    } else if (linkedProductIds.length) {
      filter = { id: linkedProductIds }
    } else {
      const project = getInstituteProject(item.slug || "")
      const category = project
        ? await measurePerformance("brand_products.category", () =>
            getCategoryByHandle([project.categoryHandle])
          )
        : undefined
      if (category) filter = { category_id: [category.id] }
    }

    if (!filter) return []

    const { response } = await measurePerformance(
      "brand_products.products",
      () =>
        listProducts({
          countryCode,
          queryParams: { ...filter, limit: 100, order: "-created_at" },
        })
    )
    return response.products
  })
}
