import { getContentItem } from "@lib/data/site-content"
import { getCategoryByHandle } from "@lib/data/categories"
import { getInstituteProject } from "@lib/data/institute-projects"
import { listProducts } from "@lib/data/products"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ countryCode: string; slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; const item = await getContentItem("brands", slug); if (!item) return {}; return { title: item.seo?.seo_title || item.title || item.name, description: item.seo?.seo_description || item.short_description, alternates: item.seo?.canonical_url ? { canonical: item.seo.canonical_url } : undefined } }
export default async function BrandPage({ params }: Props) {
  const { countryCode, slug } = await params
  const item = await getContentItem("brands", slug)
  if (!item) notFound()

  if (!item.products?.length) {
    const project = getInstituteProject(slug)
    const category = project
      ? await getCategoryByHandle([project.categoryHandle])
      : undefined

    if (category) {
      item.products = await listProducts({
        countryCode,
        queryParams: {
          category_id: [category.id],
          limit: 100,
          order: "-created_at",
        },
      }).then(({ response }) =>
        response.products.map((product) => ({
          id: product.id,
          handle: product.handle,
          title: product.title,
          thumbnail: product.thumbnail || undefined,
        }))
      )
    }
  }

  return <ContentPageTemplate item={item} />
}
