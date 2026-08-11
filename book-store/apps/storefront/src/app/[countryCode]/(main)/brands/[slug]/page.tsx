import { getContentItem } from "@lib/data/site-content"
import { getCategoryByHandle } from "@lib/data/categories"
import { getInstituteProject } from "@lib/data/institute-projects"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ countryCode: string; slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; const item = await getContentItem("brands", slug); if (!item) return {}; return { title: item.seo?.seo_title || item.title || item.name, description: item.seo?.seo_description || item.short_description, alternates: item.seo?.canonical_url ? { canonical: item.seo.canonical_url } : undefined } }
export default async function BrandPage({ params }: Props) {
  const { countryCode, slug } = await params
  const item = await getContentItem("brands", slug)
  if (!item) notFound()

  const project = getInstituteProject(slug)
  const [region, category] = await Promise.all([
    getRegion(countryCode),
    project ? getCategoryByHandle([project.categoryHandle]) : undefined,
  ])

  const linkedProductIds = item.products?.map((product) => product.id) || []
  const productFilter = linkedProductIds.length
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

  return <ContentPageTemplate item={item} products={products} region={region || undefined} />
}
