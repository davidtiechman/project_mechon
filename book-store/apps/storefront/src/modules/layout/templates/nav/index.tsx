import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import Image from "next/image"

export default async function Nav() {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 group" dir="rtl">
      <header className="relative h-[76px] mx-auto border-b border-[#d9d0bd] bg-[#fbfaf6]/95 backdrop-blur-md">
        <nav className="content-container flex items-center justify-between w-full h-full text-sm text-[#3b352a]">
          <div className="flex items-center gap-8 h-full">
            <LocalizedClientLink href="/" className="brand-lockup" data-testid="nav-store-link">
              <Image
                src="/images/institute-emblem.png"
                alt="סמל מכון מעשה רוקח"
                width={58}
                height={58}
                className="brand-emblem"
                priority
              />
              <span><strong>מכון מעשה רוקח</strong><small>ספרי קודש ומחקר תורני</small></span>
            </LocalizedClientLink>
            <div className="hidden small:flex items-center gap-7 h-full">
              <LocalizedClientLink href="/store" className="nav-link">חנות הספרים</LocalizedClientLink>
              <LocalizedClientLink href="/#new-books" className="nav-link">חדשים</LocalizedClientLink>
              <LocalizedClientLink href="/#categories" className="nav-link">קטגוריות</LocalizedClientLink>
              <LocalizedClientLink href="/#about" className="nav-link">אודות</LocalizedClientLink>
              <LocalizedClientLink href="/#articles" className="nav-link">מאמרים</LocalizedClientLink>
            </div>
          </div>

          <div className="flex items-center gap-5 h-full">
            <div className="small:hidden h-full flex items-center">
              <div className="h-full">
                <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} />
              </div>
            </div>
            <div className="hidden small:flex items-center h-full">
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
