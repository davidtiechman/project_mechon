"use client"

import {
  Transition,
} from "@headlessui/react"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
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
      onMouseEnter={openAndCancel}
      onMouseLeave={close}
    >
      <div className="relative h-full">
        <button
          ref={cartButtonRef}
          type="button"
          className="h-full hover:text-ui-fg-base"
          onClick={() => cartDropdownOpen ? close() : openAndCancel()}
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
          {`סל (${totalItems})`}
        </button>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <div
            id="nav-cart-dropdown-panel"
            aria-label="תצוגה מקדימה של סל הקניות"
            role="region"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                close()
                cartButtonRef.current?.focus()
              }
            }}
            className="fixed left-4 top-[77px] hidden w-[min(420px,calc(100vw-2rem))] border-x border-b border-gray-200 bg-white text-ui-fg-base small:block"
            data-testid="nav-cart-dropdown"
          >
            <div className="p-4 flex items-center justify-center">
              <h3 className="text-large-semi">סל הקניות</h3>
            </div>
            {cartState && cartState.items?.length ? (
              <>
                <div className="no-scrollbar grid max-h-[402px] grid-cols-1 gap-y-8 overflow-y-auto px-4 pb-4">
                  {cartState.items
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "")
                        ? -1
                        : 1
                    })
                    .map((item) => (
                      <div
                        className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-x-4"
                        key={item.id}
                        data-testid="cart-item"
                      >
                        <LocalizedClientLink
                          href={`/products/${item.product_handle}`}
                          className="w-20"
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
                                <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-base-regular">
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
                <div className="p-4 flex flex-col gap-y-4 text-small-regular">
                  <div className="flex items-center justify-between">
                    <span className="text-ui-fg-base font-semibold">
                      סה״כ
                    </span>
                    <span
                      className="text-large-semi"
                      data-testid="cart-total"
                      data-value={total}
                    >
                      {convertToLocale({
                        amount: total,
                        currency_code: cartState.currency_code,
                      })}
                    </span>
                  </div>
                  <LocalizedClientLink href="/cart" passHref>
                    <Button
                      className="w-full"
                      size="large"
                      data-testid="go-to-cart-button"
                    >
                      מעבר לסל
                    </Button>
                  </LocalizedClientLink>
                </div>
              </>
            ) : (
              <div>
                <div className="flex py-16 flex-col gap-y-4 items-center justify-center">
                  <div className="bg-gray-900 text-small-regular flex items-center justify-center w-6 h-6 rounded-full text-white">
                    <span>0</span>
                  </div>
                  <span>סל הקניות שלך ריק.</span>
                  <div>
                    <LocalizedClientLink href="/store">
                      <>
                        <span className="sr-only">מעבר לכל הספרים</span>
                        <Button onClick={close}>לכל הספרים</Button>
                      </>
                    </LocalizedClientLink>
                  </div>
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
