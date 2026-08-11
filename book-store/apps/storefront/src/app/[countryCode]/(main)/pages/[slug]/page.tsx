import { getContentItem } from "@lib/data/site-content"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const item = await getContentItem("pages", slug); if (!item) return {}
  return { title: item.seo?.seo_title || item.title, description: item.seo?.seo_description || item.excerpt, alternates: item.seo?.canonical_url ? { canonical: item.seo.canonical_url } : undefined, openGraph: { title: item.seo?.og_title || item.title, description: item.seo?.og_description || item.excerpt, images: item.seo?.og_image ? [item.seo.og_image] : undefined } }
}
export default async function Page({ params }: Props) { const { slug } = await params; const item = await getContentItem("pages", slug); if (!item) notFound(); return <ContentPageTemplate item={item} /> }
