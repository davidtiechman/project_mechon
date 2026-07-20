import type { Metadata } from "next"
import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"
import Hero from "@modules/home/components/hero"

export const metadata: Metadata = {
  title: { absolute: "מכון מעשה רוקח" },
  description: "אתר הספרים של מכון מעשה רוקח",
}

const articles = [
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
  const region = await getRegion(countryCode)

  const [productsResult, categories] = await Promise.all([
    listProducts({
      countryCode,
      queryParams: { limit: 6, order: "-created_at" },
    }),
    listCategories({ limit: 6 }),
  ])

  const products = productsResult.response.products
  const populatedCategories = categories.filter(
    (category) => !category.parent_category && (category.products?.length ?? 0) > 0
  )

  return (
    <main className="min-h-screen bg-[#f5efe6]/95 text-[#2f241e] backdrop-blur-[1px]">
      <Hero />

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
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 small:grid-cols-3 small:gap-x-7">
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

      <section id="categories" className="bg-[#e8ddd0]/95">
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

      <section id="articles" className="border-y border-[#d9d0bd] bg-white/90">
        <div className="home-section content-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">מתוך בית המדרש</span>
              <h2>מאמרים אחרונים</h2>
            </div>
            <span className="text-xs text-[#756d5e]">תוכן לדוגמה</span>
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
