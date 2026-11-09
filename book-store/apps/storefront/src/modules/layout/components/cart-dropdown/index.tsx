"use client"

import {
  Transition,
} from "@headlessui/react"
import { HEADER_MENU_GROUP, useHoverMenu } from "@lib/hooks/use-hover-menu"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"

const CartDropdown = ({
  cart: cartState,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timer | undefined>(
    undefined,
  )
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false)

  const open = () => setCartDropdownOpen(true)
  const close = () => setCartDropdownOpen(false)

  const totalItems =
    cartState?.items?.reduce((acc, item) => {
      return acc + item.quantity
    }, 0) || 0

  const total = cartState?.total ?? 0
  const itemRef = useRef<number>(totalItems || 0)
  const cartButtonRef = useRef<HTMLButtonElement>(null)

  const timedOpen = () => {
    // Close any other header menu before the cart pops open after adding a book
    hover.activate()
    open()

    const timer = setTimeout(close, 5000)

    setActiveTimer(timer)
  }

  const openAndCancel = () => {
    if (activeTimer) {
      clearTimeout(activeTimer)
    }

    open()
  }

  const cartPanelRef = useRef<HTMLDivElement>(null)
  const hover = useHoverMenu(openAndCancel, () => {
    if (!cartPanelRef.current?.contains(document.activeElement)) close()
  }, { group: HEADER_MENU_GROUP, closeImmediately: close })

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (activeTimer) {
        clearTimeout(activeTimer)
      }
    }
  }, [activeTimer])

  const pathname = usePathname()

  // open cart dropdown when modifying the cart items, but only if we're not on the cart page
  useEffect(() => {
    if (itemRef.current !== totalItems && !pathname.includes("/cart")) {
      timedOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemRef.current])

  return (
    <div
      className="h-full z-50"
      onPointerEnter={hover.onPointerEnter}
      onPointerLeave={hover.onPointerLeave}
      onFocusCapture={hover.onFocusCapture}
    >
      <div className="relative h-full">
        <button
          ref={cartButtonRef}
          type="button"
          className="flex h-full shrink-0 items-center"
          aria-label={`סל הקניות, ${totalItems} פריטים`}
          onClick={() => {
            hover.activate()
            if (cartDropdownOpen) close()
            else openAndCancel()
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              close()
              cartButtonRef.current?.focus()
            }
          }}
          aria-expanded={cartDropdownOpen}
          aria-controls="nav-cart-dropdown-panel"
          data-testid="nav-cart-link"
        >
          <span className="relative grid aspect-square h-9 w-9 min-w-[2.25rem] medium:h-10 medium:w-10 medium:min-w-[2.5rem] shrink-0 place-items-center rounded-full border-[1.5px] border-[#d6c8ba] bg-[#fffaf5] text-[#4a2d21] transition-colors medium:border-2 hover:border-[#9a7130] hover:bg-[#f3ebe3]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 medium:h-5 medium:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
            {totalItems > 0 && (
              <span aria-hidden="true" className="absolute -left-1 -top-1 grid aspect-square h-5 w-5 shrink-0 medium:-left-1.5 medium:-top-1.5 medium:h-6 medium:w-6 place-items-center rounded-full bg-[#4a2d21] p-0 text-xs font-bold leading-none text-white tabular-nums ring-2 ring-[#faf6f1]">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </span>
        </button>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
        >
          <div
            ref={cartPanelRef}
            id="nav-cart-dropdown-panel"
            aria-label="תצוגה מקדימה של סל הקניות"
            role="region"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                close()
                cartButtonRef.current?.focus()
              }
            }}
            className="absolute left-0 top-full z-[60] -mt-2 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-[#dfd0c0] bg-[#faf6f1] p-2 text-right text-[#352820] shadow-xl"
            dir="rtl"
            data-testid="nav-cart-dropdown"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#dfd0c0] px-3 pb-3 pt-2">
              <h3 className="text-base font-semibold text-[#4a2d21]">סל הקניות</h3>
              {totalItems > 0 && (
                <span className="text-sm text-[#75685b]">{totalItems} פריטים</span>
              )}
            </div>
            {cartState && cartState.items?.length ? (
              <>
                <div className="no-scrollbar grid max-h-[402px] grid-cols-1 gap-y-2 overflow-y-auto py-2">
                  {cartState.items
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "")
                        ? -1
                        : 1
                    })
                    .map((item) => (
                      <div
                        className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-x-3 rounded-md p-2 transition-colors hover:bg-[#f3ebe3]"
                        key={item.id}
                        data-testid="cart-item"
                      >
                        <LocalizedClientLink
                          href={`/products/${item.product_handle}`}
                          className="block w-[72px] overflow-hidden rounded border border-[#e2d6ca] bg-white"
                        >
                          <Thumbnail
                            thumbnail={item.thumbnail}
                            images={item.variant?.product?.images}
                            size="square"
                            alt={`תמונת ${item.title}`}
                          />
                        </LocalizedClientLink>
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div className="flex flex-col flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="flex min-w-0 flex-1 flex-col">
                                <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold text-[#4b3c2c]">
                                  <LocalizedClientLink
                                    href={`/products/${item.product_handle}`}
                                    data-testid="product-link"
                                  >
                                    {item.title}
                                  </LocalizedClientLink>
                                </h3>
                                <LineItemOptions
                                  variant={item.variant}
                                  data-testid="cart-item-variant"
                                  data-value={item.variant}
                                />
                                <span
                                  className="text-sm text-[#75685b]"
                                  data-testid="cart-item-quantity"
                                  data-value={item.quantity}
                                >
                                  כמות: {item.quantity}
                                </span>
                              </div>
                              <div className="flex justify-end">
                                <LineItemPrice
                                  item={item}
                                  style="tight"
                                  currencyCode={cartState.currency_code}
                                />
                              </div>
                            </div>
                          </div>
                          <DeleteButton
                            id={item.id}
                            className="mt-1"
                            data-testid="cart-item-remove-button"
                          >
                            הסרה
                          </DeleteButton>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="flex flex-col gap-y-3 border-t border-[#dfd0c0] px-3 pb-2 pt-3 text-small-regular">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#4b3c2c]">
                      סה״כ
                    </span>
                    <span
                      className="text-large-semi text-[#4a2d21]"
                      data-testid="cart-total"
                      data-value={total}
                    >
                      {convertToLocale({
                        amount: total,
                        currency_code: cartState.currency_code,
                      })}
                    </span>
                  </div>
                  <LocalizedClientLink
                    href="/cart"
                    className="flex h-11 w-full items-center justify-center rounded-md bg-[#4a2d21] px-4 text-base font-semibold text-white transition-colors hover:bg-[#8a5a3c]"
                    data-testid="go-to-cart-button"
                  >
                    מעבר לסל
                  </LocalizedClientLink>
                </div>
              </>
            ) : (
              <div>
                <div className="flex flex-col items-center justify-center gap-y-3 px-3 py-8 text-center">
                  <span className="grid aspect-square h-10 w-10 place-items-center rounded-full border-2 border-[#d6c8ba] bg-[#fffaf5] text-[#4a2d21]" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
                  </span>
                  <span className="text-base text-[#4b3c2c]">סל הקניות שלך ריק.</span>
                  <LocalizedClientLink
                    href="/store"
                    onClick={close}
                    className="flex h-11 w-full items-center justify-center rounded-md bg-[#4a2d21] px-4 text-base font-semibold text-white transition-colors hover:bg-[#8a5a3c]"
                  >
                    לכל הספרים
                  </LocalizedClientLink>
                </div>
              </div>
            )}
          </div>
        </Transition>
      </div>
    </div>
  )
}

export default CartDropdown
