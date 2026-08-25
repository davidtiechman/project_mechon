import { getContentItem } from "@lib/data/site-content"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  canonicalMetadata,
  metadataDescription,
} from "@lib/util/seo"
import { legalPages } from "@lib/legal-content"
import ContactForm from "@modules/content/components/contact-form"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string; slug: string }> }

const legalPageTitles: Record<string, string> = {
  terms: "תקנון ותנאי רכישה",
  privacy: "מדיניות פרטיות",
  cancellations: "ביטולים והחזרות",
  shipping: "משלוחים ואיסוף עצמי",
  accessibility: "הצהרת נגישות",
  contact: "צור קשר",
}

const getPageItem = async (slug: string) => {
  const item = await getContentItem("pages", slug)

  if (item) return item

  const fallback = legalPages[slug]
  if (!fallback) return null

  if (process.env.NODE_ENV === "development") return fallback

  return {
    ...fallback,
    status: "published",
    excerpt: "העמוד אינו זמין כרגע. מומלץ לנסות שוב בעוד מספר דקות.",
    content: undefined,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode, slug } = await params
  const item = await getPageItem(slug)
  if (!item) return {}
  const legalTitle = legalPageTitles[slug]
  return {
    title: legalTitle
      ? { absolute: `${legalTitle} | מכון מעשה רוקח` }
      : item.seo?.seo_title || item.title,
    description: metadataDescription(
      item.seo?.seo_description,
      item.excerpt,
      item.content,
      item.title,
    ),
    alternates: canonicalMetadata(countryCode, `pages/${slug}`),
    openGraph: {
      title:
        item.seo?.og_title ||
        (legalTitle ? `${legalTitle} | מכון מעשה רוקח` : item.title),
      description: item.seo?.og_description || item.excerpt,
      images: item.seo?.og_image ? [item.seo.og_image] : undefined,
    },
  }
}
export default async function Page({ params }: Props) {
  const { slug } = await params
  const item = await getPageItem(slug)
  if (!item) notFound()
  return (
    <ContentPageTemplate item={item}>
      {slug === "shipping" && (
        <nav
          aria-label="מידע קשור"
          className="content-container max-w-4xl pb-14 text-right small:max-w-5xl large:max-w-6xl"
        >
          <LocalizedClientLink
            href="/pages/cancellations"
            className="font-medium text-[#4a2d21] underline underline-offset-4"
          >
            למידע על ביטולים והחזרות
          </LocalizedClientLink>
        </nav>
      )}
      {slug === "cancellations" && (
        <nav
          aria-label="מידע קשור"
          className="content-container max-w-4xl pb-14 text-right small:max-w-5xl large:max-w-6xl"
        >
          <LocalizedClientLink
            href="/pages/contact"
            className="font-medium text-[#4a2d21] underline underline-offset-4"
          >
            ליצירת קשר בנושא ביטול או החזרה
          </LocalizedClientLink>
        </nav>
      )}
      {slug === "contact" && <ContactForm />}
    </ContentPageTemplate>
  )
}
