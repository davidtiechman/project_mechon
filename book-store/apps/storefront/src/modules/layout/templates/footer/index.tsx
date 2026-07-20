import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

export default async function Footer() {
  const productCategories = await listCategories()
  const rootCategories = productCategories
    .filter(
      (category) =>
        !category.parent_category && (category.products?.length ?? 0) > 0
    )
    .slice(0, 6)

  return (
    <footer className="bg-[#2d1c16] text-[#f4ebe0]" dir="rtl">
      <div className="content-container py-14 small:py-20">
        <div className="grid gap-12 border-b border-white/15 pb-12 small:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-md">
            <LocalizedClientLink href="/" className="brand-lockup brand-lockup-light">
              <Image
                src="/images/institute-emblem.png"
                alt="סמל מכון מעשה רוקח"
                width={76}
                height={76}
                className="brand-emblem brand-emblem-light"
              />
              <span><strong>מכון מעשה רוקח</strong><small>ספרי קודש ומחקר תורני</small></span>
            </LocalizedClientLink>
            <p className="mt-6 leading-7 text-[#d8d0c0]">
              מחקר, ההדרה והוצאה לאור של ספרי קודש במהדורות מדויקות ומאירות עיניים.
            </p>
          </div>
          <div>
            <h3 className="footer-heading">ניווט</h3>
            <ul className="footer-links">
              <li><LocalizedClientLink href="/store">חנות הספרים</LocalizedClientLink></li>
              <li><LocalizedClientLink href="/#new-books">ספרים חדשים</LocalizedClientLink></li>
              <li><LocalizedClientLink href="/#about">אודות המכון</LocalizedClientLink></li>
              <li><LocalizedClientLink href="/account">החשבון שלי</LocalizedClientLink></li>
            </ul>
          </div>
          <div>
            <h3 className="footer-heading">קטגוריות</h3>
            <ul className="footer-links">
              {rootCategories.map((category) => (
                <li key={category.id}>
                  <LocalizedClientLink href={`/categories/${category.handle}`}>{category.name}</LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-7 text-xs text-[#bdb5a6] xsmall:flex-row xsmall:items-center xsmall:justify-between">
          <span>© {new Date().getFullYear()} מכון מעשה רוקח. כל הזכויות שמורות.</span>
          <span>תורה · מחקר · מורשת</span>
        </div>
      </div>
    </footer>
  )
}
