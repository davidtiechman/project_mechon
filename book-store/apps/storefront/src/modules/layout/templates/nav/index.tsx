import {
  measurePerformance,
  measureSynchronous,
} from "@lib/observability/performance"
import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import AccountMenu from "@modules/layout/components/account-menu"
import { GuestCircle } from "@modules/layout/components/account-menu/account-dropdown"
import SideMenu from "@modules/layout/components/side-menu"
import Image from "next/image"
import InstituteProjectsMenu from "@modules/layout/components/institute-projects-menu"
import { getActiveCatalog, listContent } from "@lib/data/site-content"
import { getYearCycleMenu } from "@lib/data/categories"
import YearCycleMenu from "@modules/layout/components/year-cycle-menu"
import { getBrandProducts } from "@lib/data/brand-products"
import { resolveMediaUrl } from "@lib/util/resolve-media-url"
import { instituteProjects } from "@lib/data/institute-projects"
import { HeaderProductSearch } from "@modules/search/components/global-product-search"

export default function Nav(props: { countryCode: string }) {
  return measurePerformance("nav.ready", () => renderNav(props))
}

async function renderNav({ countryCode }: { countryCode: string }) {
  const [regions, locales, currentLocale, brands, catalog, yearCycleMenu] =
    await measurePerformance("nav.initial_dependencies", () =>
      Promise.all([
        measurePerformance("nav.regions", () =>
          listRegions().then((regions: StoreRegion[]) => regions)
        ),
        measurePerformance("nav.locales", listLocales),
        measurePerformance("nav.locale", getLocale),
        measurePerformance("nav.brands", () => listContent("brands")),
        measurePerformance("nav.catalog", getActiveCatalog),
        measurePerformance("nav.year_cycle", getYearCycleMenu),
      ])
    )

  const projects = await measurePerformance("nav.brand_products_batch", () =>
    Promise.all(
      (brands.length ? brands : instituteProjects).map(async (brand) => ({
        slug: brand.slug!,
        title: brand.title || ("name" in brand ? brand.name : "") || "",
        products: (await getBrandProducts(brand, countryCode)).map(
          (product) => ({
            id: product.id,
            handle: product.handle!,
            title: product.title,
            thumbnail: resolveMediaUrl(
              product.thumbnail || product.images?.[0]?.url
            ),
          })
        ),
      }))
    )
  )

  return measureSynchronous("nav.jsx", () => (
    <div className="sticky top-0 inset-x-0 z-50 group" dir="rtl">
      <header className="relative h-[88px] mx-auto border-b border-[#e0d2c5] bg-[#faf6f1]/95 backdrop-blur-md">
        <nav
          aria-label="ניווט ראשי"
          className="main-navigation content-container flex items-center w-full h-full gap-3 whitespace-nowrap text-[22px] medium:text-[20px] xlarge:text-[22px] text-[#3b352a] 2xlarge:text-[24px]"
        >
          <LocalizedClientLink
            href="/"
            className="brand-lockup nav-brand"
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
          <div className="hidden min-w-0 flex-1 items-center h-full medium:flex">
            <InstituteProjectsMenu projects={projects} leading={
              <LocalizedClientLink href="/store" className="nav-link">
                חנות הספרים
              </LocalizedClientLink>
            } trailing={yearCycleMenu && <YearCycleMenu menu={yearCycleMenu} />} ending={
              catalog ? <a href="/api/catalog/download" download={catalog.file_name} className="whitespace-nowrap rounded-md border border-[#8a6f4d] px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-[#8a6f4d] hover:text-white">
                קטלוג להורדה
              </a> : <span aria-disabled="true" title="הקטלוג יעלה בקרוב" className="cursor-not-allowed whitespace-nowrap rounded-md border border-[#cbbba8] px-2.5 py-1.5 text-sm text-[#8d8275] opacity-70">
                הקטלוג יעלה בקרוב
              </span>
            } />
          </div>

          <div className="mr-auto flex shrink-0 items-center gap-2 h-full 2xlarge:gap-4">
            <HeaderProductSearch countryCode={countryCode} />
            <div className="medium:hidden h-full flex items-center">
              <div className="h-full">
                <SideMenu
                  projects={projects}
                  regions={regions}
                  locales={locales}
                  currentLocale={currentLocale}
                  catalog={catalog}
                  yearCycleMenu={yearCycleMenu}
                />
              </div>
            </div>
            <div className="flex items-center h-full">
              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="flex h-full shrink-0 items-center"
                    href="/account"
                    aria-label="החשבון שלי"
                    data-testid="nav-account-link"
                  >
                    <GuestCircle />
                  </LocalizedClientLink>
                }
              >
                <AccountMenu />
              </Suspense>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="flex h-full shrink-0 items-center"
                  href="/cart"
                  aria-label="סל הקניות"
                  data-testid="nav-cart-link"
                >
                  <span className="relative grid aspect-square h-9 w-9 min-w-[2.25rem] medium:h-10 medium:w-10 medium:min-w-[2.5rem] shrink-0 place-items-center rounded-full border-[1.5px] border-[#d6c8ba] bg-[#fffaf5] text-[#4a2d21] transition-colors medium:border-2 hover:border-[#9a7130] hover:bg-[#f3ebe3]">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 medium:h-5 medium:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
                  </span>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  ))
}
