import Image from "next/image"
import { ContentItem } from "@lib/data/site-content"
import { HttpTypes } from "@medusajs/types"
import ProductPreview from "@modules/products/components/product-preview"
import { ReactNode } from "react"

export default function ContentPageTemplate({
  item,
  products,
  region,
  children,
  compactHeader = false,
  headerEmblem,
  headingLevel: Heading = "h1",
}: {
  item: ContentItem
  products?: HttpTypes.StoreProduct[]
  region?: HttpTypes.StoreRegion
  children?: ReactNode
  compactHeader?: boolean
  headerEmblem?: { src: string; alt: string }
  headingLevel?: "h1" | "h2"
}) {
  const content = item.content
    ?.replace(/<h1(\s[^>]*)?>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>")
  const isDraft = item.status === "draft"

  return (
    <div dir="rtl" className="min-h-[60vh] bg-[#faf6f1]">
      <header className="border-b border-[#ddcec0] bg-[#f8f1ea]">
        <div className={`content-container text-right ${compactHeader ? "py-4 small:py-5" : "py-14 small:py-16"}`}>
          <div className="flex items-start justify-between gap-4 small:gap-8">
            <div className="min-w-0 flex-1">
              <Heading className="break-words text-4xl font-normal text-[#4a2d21] small:text-5xl">
                {item.title || item.name}
              </Heading>
              {(item.excerpt || item.short_description) && (
                <p className={`${compactHeader ? "mt-2" : "mt-5"} max-w-3xl text-lg leading-8 text-[#62594d]`}>
                  {item.excerpt || item.short_description}
                </p>
              )}
            </div>
            {headerEmblem && (
              <Image
                src={headerEmblem.src}
                alt={headerEmblem.alt}
                width={1420}
                height={1108}
                sizes="(min-width: 1024px) 128px, 80px"
                className="h-auto w-[80px] shrink-0 object-contain small:w-[128px]"
                priority
              />
            )}
          </div>
          {item.hero_image && (
            <Image
              src={item.hero_image}
              alt={item.image_alt || ""}
              width={1200}
              height={600}
              className="mt-8 max-h-[500px] w-full rounded object-cover"
            />
          )}
        </div>
      </header>
      {isDraft && (
        <aside
          role="status"
          className="content-container mt-8 max-w-4xl border-2 border-amber-700 bg-amber-50 p-5 text-right text-amber-950 small:max-w-5xl large:max-w-6xl"
        >
          <strong className="block">תוכן זה הוא טיוטה ואינו נוסח מאושר.</strong>
          <span>
            הפרטים בעמוד עדיין בהשלמה ואין להסתמך עליהם כנוסח משפטי סופי.
          </span>
        </aside>
      )}
      {content && !isDraft && (
        <article
          className="content-page-body content-container prose prose-lg max-w-4xl py-14 text-right small:max-w-5xl small:py-10 large:max-w-6xl"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
      {children}
      {region && products && products.length > 0 && (
        <section className="content-container pb-14">
          <ul className="grid w-full grid-cols-2 gap-x-5 gap-y-12 small:grid-cols-3 small:gap-x-8 small:gap-y-16 medium:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
