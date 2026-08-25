"use client"

import { Heading, Text, clx } from "@modules/common/components/ui"

import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])
      ?.length > 0 &&
    cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          tabIndex={-1}
          data-checkout-step-heading="review"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            },
          )}
        >
          סיכום ואישור
        </Heading>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          <div className="flex items-start gap-x-1 w-full mb-6">
            <div className="w-full">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                לפני השלמת ההזמנה מומלץ לעיין ב־{" "}
                <LocalizedClientLink className="underline" href="/pages/terms">
                  תקנון ותנאי הרכישה
                </LocalizedClientLink>
                ,{" "}
                <LocalizedClientLink
                  className="underline"
                  href="/pages/privacy"
                >
                  מדיניות הפרטיות
                </LocalizedClientLink>{" "}
                וב־{" "}
                <LocalizedClientLink
                  className="underline"
                  href="/pages/cancellations"
                >
                  מדיניות הביטולים
                </LocalizedClientLink>
                .
              </Text>
              {/* ניתן להוסיף כאן checkbox נפרד להסכמה משפטית לאחר אישור הנוסח. */}
            </div>
          </div>
          <PaymentButton cart={cart} data-testid="submit-order-button" />
        </>
      )}
    </div>
  )
}

export default Review
