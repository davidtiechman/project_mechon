import "server-only"

import { getCategoryByHandle } from "./categories"
import { getInstituteProject } from "./institute-projects"
import { getProductTagByValue } from "./product-tags"
import { listProducts } from "./products"
import type { ContentItem } from "./site-content"

/** Shared by brand pages and navigation so both use the same catalog membership. */
export async function getBrandProducts(
  item: Pick<ContentItem, "slug" | "title" | "name" | "products">,
  countryCode: string
) {
  const title = (item.title || item.name || "").trim()
  const linkedProductIds = item.products?.map((product) => product.id) || []
  let filter: { tag_id: string[] } | { id: string[] } | { category_id: string[] } | undefined

  if (["חדשים", "ספרים חדשים"].includes(title)) {
    const tag = await getProductTagByValue("מוצר חדש")
    if (tag) filter = { tag_id: [tag.id] }
  } else if (linkedProductIds.length) {
    filter = { id: linkedProductIds }
  } else {
    const project = getInstituteProject(item.slug || "")
    const category = project
      ? await getCategoryByHandle([project.categoryHandle])
      : undefined
    if (category) filter = { category_id: [category.id] }
  }

  if (!filter) return []

  const { response } = await listProducts({
    countryCode,
    queryParams: { ...filter, limit: 100, order: "-created_at" },
  })
  return response.products
}
