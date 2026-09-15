import { getContentItem } from "@lib/data/site-content"
import { getBrandProducts } from "@lib/data/brand-products"
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

  const [region, products] = await Promise.all([
    getRegion(countryCode),
    getBrandProducts(item, countryCode),
  ])

  return (
    <ContentPageTemplate
      item={item}
      products={products}
      region={region || undefined}
    />
  )
}
