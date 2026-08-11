import { getContentItem } from "@lib/data/site-content"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = { params: Promise<{ slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; const item = await getContentItem("brands", slug); if (!item) return {}; return { title: item.seo?.seo_title || item.title || item.name, description: item.seo?.seo_description || item.short_description, alternates: item.seo?.canonical_url ? { canonical: item.seo.canonical_url } : undefined } }
export default async function BrandPage({ params }: Props) { const { slug } = await params; const item = await getContentItem("brands", slug); if (!item) notFound(); return <ContentPageTemplate item={item} /> }
