import { getContentItem } from "@lib/data/site-content"
import { getCategoryByHandle } from "@lib/data/categories"
import { getInstituteProject } from "@lib/data/institute-projects"
import { listProducts } from "@lib/data/products"
import { getProductTagByValue } from "@lib/data/product-tags"
import { getRegion } from "@lib/data/regions"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { canonicalMetadata, metadataDescription } from "@lib/util/seo"

type Props = { params: Promise<{ countryCode: string; slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, slug } = await params
  const item = await getContentItem("brands", slug)
  if (!item) return {}
  return {
    title: item.seo?.seo_title || item.title || item.name,
    description: metadataDescription(
      item.seo?.seo_description,
      item.short_description,
      item.content,
      item.title,
      item.name,
    ),
    alternates: canonicalMetadata(countryCode, `brands/${slug}`),
  }
}
export default async function BrandPage({ params }: Props) {
  const { countryCode, slug } = await params
  const item = await getContentItem("brands", slug)
  if (!item) notFound()

  const project = getInstituteProject(slug)
  const pageTitle = (item.title || item.name || "").trim()
  const isNewBooksPage = ["חדשים", "ספרים חדשים"].includes(pageTitle)
  const [region, category, newProductTag] = await Promise.all([
    getRegion(countryCode),
    project ? getCategoryByHandle([project.categoryHandle]) : undefined,
    isNewBooksPage ? getProductTagByValue("מוצר חדש") : undefined,
  ])

  const linkedProductIds = item.products?.map((product) => product.id) || []
  const productFilter = isNewBooksPage
    ? newProductTag
      ? { tag_id: [newProductTag.id] }
      : undefined
    : linkedProductIds.length
      ? { id: linkedProductIds }
      : category
        ? { category_id: [category.id] }
        : undefined

  const products = productFilter
    ? await listProducts({
        countryCode,
        queryParams: {
          ...productFilter,
          limit: 100,
          order: "-created_at",
        },
      }).then(({ response }) => response.products)
    : []

  return (
    <ContentPageTemplate
      item={item}
      products={products}
      region={region || undefined}
    />
  )
}
