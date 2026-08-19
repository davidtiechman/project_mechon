import { getContentItem } from "@lib/data/site-content"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { canonicalMetadata } from "@lib/util/seo"
import { legalPages } from "@lib/legal-content"
import ContactForm from "@modules/content/components/contact-form"

type Props = { params: Promise<{ countryCode: string; slug: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, slug } = await params
  const item = (await getContentItem("pages", slug)) || legalPages[slug]
  if (!item) return {}
  return {
    title: item.seo?.seo_title || item.title,
    description: item.seo?.seo_description || item.excerpt,
    alternates: canonicalMetadata(countryCode, `pages/${slug}`),
    openGraph: {
      title: item.seo?.og_title || item.title,
      description: item.seo?.og_description || item.excerpt,
      images: item.seo?.og_image ? [item.seo.og_image] : undefined,
    },
  }
}
export default async function Page({ params }: Props) {
  const { slug } = await params
  const item = (await getContentItem("pages", slug)) || legalPages[slug]
  if (!item) notFound()
  return (
    <ContentPageTemplate item={item}>
      {slug === "contact" && <ContactForm />}
    </ContentPageTemplate>
  )
}
