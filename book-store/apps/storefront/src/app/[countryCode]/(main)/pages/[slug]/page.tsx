import { getContentItem } from "@lib/data/site-content"
import ContentPageTemplate from "@modules/content/templates/content-page"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  canonicalMetadata,
  metadataDescription,
} from "@lib/util/seo"
import { legalPages, legalPageGroups } from "@lib/legal-content"
import { updatePublicContactRows } from "@lib/contact-details"
import ContactForm from "@modules/content/components/contact-form"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MarketingPrivacyNotice from "@modules/content/components/marketing-privacy-notice"

type Props = { params: Promise<{ countryCode: string; slug: string }> }

const legalPageTitles: Record<string, string> = {
  "terms-of-purchase": "תקנון ותנאי רכישה",
  terms: "תקנון ותנאי רכישה",
  privacy: "מדיניות פרטיות",
  cancellations: "ביטולים והחזרות",
  shipping: "משלוחים ואיסוף עצמי",
  accessibility: "הצהרת נגישות",
  contact: "צור קשר",
}

const getPageItem = async (slug: string) => {
  if (slug === "terms-of-purchase") return getPageItem("terms")
  const group = legalPageGroups[slug]
  if (group) return { id: slug, slug, title: group.title, status: "published" }
  const item = await getContentItem("pages", slug)

  if (item) return item.content
    ? { ...item, content: updatePublicContactRows(item.content) }
    : item

  const fallback = legalPages[slug]
  if (!fallback) return null

  // Contact details and the form are available even without a CMS page.
  if (slug === "contact" || process.env.NODE_ENV === "development") return fallback

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
  const legalTitle = legalPageGroups[slug]?.title || legalPageTitles[slug]
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
  const group = legalPageGroups[slug]
  if (group) {
    const sections = await Promise.all(group.sources.map(getPageItem))
    return (
      <div dir="rtl" className="bg-[#faf6f1]">
        <header className="content-container py-10 text-right">
          <h1 className="text-4xl text-[#4a2d21]">{group.title}</h1>
        </header>
        {sections.map((section, index) => section && (
          <section key={group.sources[index]} id={group.sources[index]}>
            <ContentPageTemplate item={section} headingLevel="h2">
              {group.sources[index] === "privacy" && <MarketingPrivacyNotice />}
            </ContentPageTemplate>
          </section>
        ))}
        {slug === "shipping-returns" && (
          <nav aria-label="מידע קשור" className="content-container pb-14 text-right">
            <LocalizedClientLink href="/pages/contact" className="underline">
              ליצירת קשר בנושא ביטול או החזרה
            </LocalizedClientLink>
          </nav>
        )}
      </div>
    )
  }
  return (
    <ContentPageTemplate
      compactHeader={slug === "contact"}
      item={slug === "contact" ? { ...item, content: undefined } : item}
    >
      {slug === "contact" && <ContactForm />}
    </ContentPageTemplate>
  )
}
