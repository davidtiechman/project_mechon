"use client"

import { convertToLocale } from "@lib/util/money"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    original_item_total?: number | null
    item_total?: number | null
    item_tax_total?: number | null
    shipping_subtotal?: number | null
    shipping_total?: number | null
    discount_subtotal?: number | null
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    tax_total,
    item_total,
    original_item_total,
    item_tax_total,
    shipping_total,
    discount_subtotal,
  } = totals

  return (
    <div>
      <div className="flex flex-col gap-y-2 txt-medium text-ui-fg-subtle ">
        <div className="flex items-center justify-between">
          <span>מוצרים</span>
          <span
            data-testid="cart-subtotal"
            data-value={original_item_total ?? item_total ?? 0}
          >
            {convertToLocale({
              amount: original_item_total ?? item_total ?? 0,
              currency_code,
            })}
          </span>
        </div>
        <p className="txt-small text-ui-fg-muted">המחירים כוללים מע״מ כחוק</p>
        <div className="flex items-center justify-between">
          <span>משלוח</span>
          <span data-testid="cart-shipping" data-value={shipping_total || 0}>
            {shipping_total
              ? convertToLocale({ amount: shipping_total, currency_code })
              : "יחושב בשלב הבא"}
          </span>
        </div>
        {!!discount_subtotal && (
          <div className="flex items-center justify-between">
            <span>הנחה</span>
            <span
              className="text-ui-fg-interactive"
              data-testid="cart-discount"
              data-value={discount_subtotal || 0}
            >
              -{" "}
              {convertToLocale({
                amount: discount_subtotal ?? 0,
                currency_code,
              })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="flex gap-x-1 items-center ">מע״מ (כלול במחיר)</span>
          <span data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({
              amount: item_tax_total ?? tax_total ?? 0,
              currency_code,
            })}
          </span>
        </div>
      </div>
      <div className="h-px w-full border-b border-gray-200 my-4" />
      <div className="flex items-center justify-between text-ui-fg-base mb-2 txt-medium ">
        <span>סה״כ</span>
        <span
          className="txt-xlarge-plus"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
      <div className="h-px w-full border-b border-gray-200 mt-4" />
    </div>
  )
}

export default CartTotals
