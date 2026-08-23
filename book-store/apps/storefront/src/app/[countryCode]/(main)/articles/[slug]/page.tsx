import { getContentItem } from "@lib/data/site-content"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { canonicalMetadata, metadataDescription } from "@lib/util/seo"

type Props = { params: Promise<{ countryCode: string; slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, slug } = await params
  const item = await getContentItem("articles", slug)
  if (!item) return {}
  const description = metadataDescription(
    item.seo?.seo_description,
    item.excerpt,
    item.content,
    item.title,
  )
  return {
    title: item.seo?.seo_title || item.title,
    description,
    alternates: canonicalMetadata(countryCode, `articles/${slug}`),
    openGraph: {
      type: "article",
      title: item.seo?.og_title || item.title,
      description: metadataDescription(item.seo?.og_description, description),
      images:
        item.seo?.og_image || item.featured_image
          ? [item.seo?.og_image || item.featured_image!]
          : undefined,
      publishedTime: item.published_at,
      authors: item.author ? [item.author] : undefined,
    },
  }
}
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const item = await getContentItem("articles", slug)
  if (!item) notFound()
  return <ContentPageTemplate item={item} />
}
