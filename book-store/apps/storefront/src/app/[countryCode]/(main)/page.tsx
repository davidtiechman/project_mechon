import type { Metadata } from "next"
import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import Hero from "@modules/home/components/hero"
import { getProductTagByValue } from "@lib/data/product-tags"
import { getHomeContent } from "@lib/data/site-content"
import ContentBanner from "@modules/content/components/content-banner"
import { canonicalMetadata } from "@lib/util/seo"

const homeMetadata: Metadata = {
  title: { absolute: "מכון מעשה רוקח" },
  description: "אתר הספרים של מכון מעשה רוקח",
}

export async function generateMetadata({ params }: { params: Promise<{ countryCode: string }> }): Promise<Metadata> {
  const { countryCode } = await params
  return { ...homeMetadata, alternates: canonicalMetadata(countryCode) }
}

const fallbackArticles = [
  {
    title: "על סידור עבודת השם",
    excerpt: "???",
    date: "י״ב בתמוז תשפ״ו",
  },
  {
    title: "על יצירת הפאר ביאורי חסידות",
    excerpt: "???",
    date: "כ״ח בסיוון תשפ״ו",
  },
  {
    title: "על בינה והברכה",
    excerpt: "???",
    date: "ט׳ בסיוון תשפ״ו",
  },
]

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const [region, homeContent] = await Promise.all([getRegion(countryCode), getHomeContent()])

  const [newProductTag, categories] = await Promise.all([
    getProductTagByValue("מוצר חדש"),
    listCategories({ limit: 6 }),
  ])

  const products = newProductTag
    ? await listProducts({
        countryCode,
        queryParams: {
          tag_id: [newProductTag.id],
          limit: 6,
          order: "-created_at",
        },
      }).then(({ response }) => response.products)
    : []
  const populatedCategories = categories.filter(
    (category) => !category.parent_category && (category.products?.length ?? 0) > 0
  )
  const hero = homeContent?.sections.find((section) => section.type === "hero" && section.active)
  const articles = homeContent?.articles?.length ? homeContent.articles.map((article) => ({ title: article.title || "", excerpt: article.excerpt || "", date: article.published_at ? new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(article.published_at)) : "" })) : fallbackArticles

  return (
    <main className="min-h-screen bg-[#f6f0e9]/80 text-[#352820] backdrop-blur-[1px]">
      <Hero eyebrow={hero?.subtitle} title={hero?.title} description={hero?.content} buttonText={hero?.data?.button_text} buttonUrl={hero?.data?.button_url} image={hero?.data?.desktop_image} />
      {homeContent?.banners.filter((banner) => banner.placement === "homepage_top").map((banner) => <ContentBanner banner={banner} key={banner.id} />)}

      <section id="new-books" className="home-section content-container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">מן הדפוס</span>
            <h2>ספרים חדשים</h2>
          </div>
          <LocalizedClientLink href="/store" className="text-link">
            לכל הספרים <span aria-hidden="true">←</span>
          </LocalizedClientLink>
        </div>
        {region && products.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-12 small:grid-cols-3 small:gap-x-8 small:gap-y-16">
            {products.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} isFeatured />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-home-state">הספרים החדשים יופיעו כאן בקרוב.</div>
        )}
      </section>

      <section id="categories" className="bg-[#ede1d6]/85">
        <div className="home-section content-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">אוצר הספרים</span>
              <h2>קטגוריות ספרים</h2>
            </div>
          </div>
          <div className="grid gap-4 xsmall:grid-cols-2 small:grid-cols-3">
            {populatedCategories.map((category, index) => (
              <LocalizedClientLink
                href={`/categories/${category.handle}`}
                key={category.id}
                className="category-card group"
              >
                <span className="category-number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{category.name}</h3>
                <span className="category-arrow" aria-hidden="true">←</span>
              </LocalizedClientLink>
            ))}
            {populatedCategories.length === 0 && (
              <div className="empty-home-state xsmall:col-span-2 small:col-span-3">
                קטגוריות הספרים יעודכנו בקרוב.
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="about" className="home-section content-container">
        <div className="about-grid">
          <div className="about-seal" aria-hidden="true">
            <span>מעשה</span>
            <strong>רוקח</strong>
            <small>תורה · מחקר · מורשת</small>
          </div>
          <div className="about-copy">
            <span className="eyebrow">אודות המכון</span>
            <h2>ספרים שנכתבו בעמל,<br />למען הדורות הבאים</h2>
            <p>
              מכון מעשה רוקח עוסק בהדרת תורות רבותינו מבעלזא, וכן ביצירת המופת סידור עבודת השם תהילים עבודת השם עם ביאור מבוסס פירוש רש״י וכן ביצירה המופלאה ביאורי חסידות על סדר הפרשיות ועוד המון הוצאות מפוארות
            </p>
            <LocalizedClientLink href="/store" className="brand-button inline-flex">
              היכרות עם ספרי המכון
            </LocalizedClientLink>
          </div>
        </div>
      </section>

      <section id="articles" className="border-y border-[#dfd1c4] bg-[#faf6f1]/90">
        <div className="home-section content-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">מתוך בית המדרש</span>
              <h2>מאמרים אחרונים</h2>
            </div>
          </div>
          <div className="grid gap-8 small:grid-cols-3">
            {articles.map((article, index) => (
              <article className="article-card" key={article.title}>
                <span className="article-index">{String(index + 1).padStart(2, "0")}</span>
                <time>{article.date}</time>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
