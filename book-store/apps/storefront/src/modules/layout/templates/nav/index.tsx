import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import Image from "next/image"
import InstituteProjectsMenu from "@modules/layout/components/institute-projects-menu"
import { getActiveCatalog, listContent } from "@lib/data/site-content"

export default async function Nav() {
  const [regions, locales, currentLocale, brands, catalog] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listContent("brands"),
    getActiveCatalog(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 group" dir="rtl">
      <header className="relative h-[76px] mx-auto border-b border-[#e0d2c5] bg-[#faf6f1]/95 backdrop-blur-md">
        <nav
          aria-label="ניווט ראשי"
          className="content-container flex items-center justify-between w-full h-full text-sm text-[#3b352a]"
        >
          <div className="flex items-center gap-8 h-full">
            <LocalizedClientLink
              href="/"
              className="brand-lockup"
              data-testid="nav-store-link"
            >
              <Image
                src="/images/institute-emblem-open-left.png"
                alt="סמל מכון מעשה רוקח"
                width={58}
                height={58}
                className="brand-emblem"
                priority
              />
              <span>
                <strong>מכון מעשה רוקח</strong>
                <small>ספרי קודש ומחקר תורני</small>
              </span>
            </LocalizedClientLink>
            <div className="hidden large:flex items-center gap-4 h-full">
              <LocalizedClientLink href="/store" className="nav-link">
                חנות הספרים
              </LocalizedClientLink>
              <InstituteProjectsMenu
                projects={
                  brands.length
                    ? brands.map((brand) => ({
                        slug: brand.slug!,
                        title: brand.title || brand.name || "",
                      }))
                    : undefined
                }
              />
              <LocalizedClientLink href="/#about" className="nav-link">
                אודות
              </LocalizedClientLink>
              <LocalizedClientLink href="/#articles" className="nav-link">
                מאמרים
              </LocalizedClientLink>
              {catalog ? <a href={catalog.file_url} download={catalog.file_name} className="rounded-md border border-[#8a6f4d] px-3 py-2 font-medium transition-colors hover:bg-[#8a6f4d] hover:text-white">
                קטלוג להורדה
              </a> : <span aria-disabled="true" title="הקטלוג יעלה בקרוב" className="cursor-not-allowed rounded-md border border-[#cbbba8] px-3 py-2 text-[#8d8275] opacity-70">
                הקטלוג יעלה בקרוב
              </span>}
            </div>
          </div>

          <div className="flex items-center gap-5 h-full">
            <div className="large:hidden h-full flex items-center">
              <div className="h-full">
                <SideMenu
                  regions={regions}
                  locales={locales}
                  currentLocale={currentLocale}
                  catalog={catalog}
                />
              </div>
            </div>
            <div className="hidden large:flex items-center h-full">
              <LocalizedClientLink
                className="nav-link"
                href="/account"
                data-testid="nav-account-link"
              >
                החשבון שלי
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="nav-link flex gap-2"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  סל (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
