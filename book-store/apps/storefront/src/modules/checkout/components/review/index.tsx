"use client"

import { Heading, clx } from "@modules/common/components/ui"

import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { useRef, useState } from "react"
import { acceptCheckoutTerms } from "@lib/data/checkout-consent"
import { CHECKOUT_CONSENT_ERROR, CHECKOUT_TERMS_VERSION } from "@lib/checkout-consent"
import MarketingCheckbox from "@modules/account/components/marketing-checkbox"
import { MARKETING_CONSENT_VERSION } from "@lib/marketing-consent"
import { saveCheckoutMarketingConsent } from "@lib/data/marketing-consent"

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const searchParams = useSearchParams()
  const [accepted, setAccepted] = useState(false)
  const [marketingAccepted, setMarketingAccepted] = useState(false)
  const [marketingMessage, setMarketingMessage] = useState("")
  const [consentError, setConsentError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const checkboxRef = useRef<HTMLInputElement>(null)

  const beforePayment = async () => {
    if (!accepted) {
      setConsentError(CHECKOUT_CONSENT_ERROR)
      checkboxRef.current?.focus()
      return false
    }
    setConsentError("")
    await acceptCheckoutTerms(accepted, CHECKOUT_TERMS_VERSION)
    try {
      await saveCheckoutMarketingConsent(marketingAccepted, MARKETING_CONSENT_VERSION)
    } catch {
      // Optional marketing enrollment must never prevent an otherwise valid purchase.
      setMarketingMessage("בחירת הדיוור לא נשמרה. ניתן לעדכן אותה בהעדפות הדיוור; ההזמנה יכולה להמשיך כרגיל.")
    }
    return true
  }

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
          <div className="mb-6 rounded-md border border-[#ddcec0] bg-[#faf6f1] p-4">
            <label className="flex items-start gap-3 text-base leading-7" htmlFor="checkout-terms-consent">
              <input
                ref={checkboxRef}
                id="checkout-terms-consent"
                type="checkbox"
                required
                checked={accepted}
                disabled={submitting}
                aria-invalid={!!consentError}
                aria-describedby={consentError ? "checkout-consent-error" : undefined}
                onChange={(event) => {
                  setAccepted(event.target.checked)
                  setConsentError("")
                }}
                className="mt-1 h-5 w-5 shrink-0 accent-[#4a2d21]"
              />
              <span>
                אני מאשר/ת שקראתי והסכמתי ל<a className="underline" href="/il/pages/terms-of-purchase" target="_blank" rel="noopener noreferrer">תקנון ותנאי הרכישה</a>,{" "}
                ל<a className="underline" href="/il/pages/shipping-returns" target="_blank" rel="noopener noreferrer">מדיניות המשלוחים, הביטולים וההחזרות</a>{" "}
                ול<a className="underline" href="/il/pages/privacy-accessibility" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות</a>.
              </span>
            </label>
            {consentError && <p id="checkout-consent-error" role="alert" className="mt-3 text-sm text-rose-700">{consentError}</p>}
          </div>
          <MarketingCheckbox checked={marketingAccepted} onChange={setMarketingAccepted} disabled={submitting} />
          {marketingMessage && <p role="status" className="mb-4 text-sm">{marketingMessage}</p>}
          <PaymentButton cart={cart} beforePayment={beforePayment} onSubmittingChange={setSubmitting} data-testid="submit-order-button" />
        </>
      )}
    </div>
  )
}

export default Review
