"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { Heading } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import GoogleAuthButton, { CHECKOUT_DRAFT_KEY } from "@modules/account/components/google-auth-button"
import MarketingCheckbox from "@modules/account/components/marketing-checkbox"
import compareAddresses from "@lib/util/compare-addresses"
import { convertToLocale } from "@lib/util/money"
import { installmentLabel, installmentPlan, maxInstallments, PaymentOptions, paymentMethodsText } from "@lib/util/installments"
import { prepareQuickCheckout } from "@lib/data/quick-checkout"
import type { NedarimStatus } from "@lib/data/nedarim"
import ShippingAddress from "../shipping-address"
import BillingAddress from "../billing_address"
import Shipping from "../shipping"
import NedarimPaymentButton from "../nedarim-payment"

const FORM_ID = "checkout-details"

export default function QuickCheckout({ cart, customer, shippingMethods, checkoutPaused, paymentOptions }: {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
  shippingMethods: HttpTypes.StoreCartShippingOption[]
  checkoutPaused: boolean
  paymentOptions?: PaymentOptions | null
}) {
  const pathname = usePathname()
  const form = useRef<HTMLFormElement>(null)
  const paymentSection = useRef<HTMLElement>(null)
  const prepared = useRef<NedarimStatus | null>(null)
  const [sameAsBilling, setSameAsBilling] = useState(() =>
    cart.shipping_address && cart.billing_address ? compareAddresses(cart.shipping_address, cart.billing_address) : true)
  const [accepted, setAccepted] = useState(false)
  const [marketingAccepted, setMarketingAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [marketingMessage, setMarketingMessage] = useState("")
  const [oauthDraft, setOauthDraft] = useState<Record<string, string>>()
  const [paymentMode, setPaymentMode] = useState<"single" | "installments">("single")
  const [installments, setInstallments] = useState(2)
  const policy = paymentOptions?.policy
  const maxCount = maxInstallments(cart.total, cart.currency_code, policy)
  // A single payment unless the customer explicitly chose installments (and the order qualifies).
  const chosenInstallments = paymentMode === "installments" && maxCount > 1 ? Math.min(Math.max(installments, 2), maxCount) : 1
  const money = (amount: number) => convertToLocale({ amount, currency_code: cart.currency_code })
  const optionCard = (selected: boolean) => `flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 ${selected ? "border-[#68462f] bg-[#faf6f1]" : "border-[#ddcec0] bg-white"}`

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
      if (!saved) return
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
      const draft = JSON.parse(saved)
      if (draft.values && typeof draft.values === "object") setOauthDraft(draft.values)
      if (typeof draft.sameAsBilling === "boolean") setSameAsBilling(draft.sameAsBilling)
    } catch { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY) }
  }, [])

  useEffect(() => {
    if (paymentOpen) paymentSection.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [paymentOpen])

  const beforePayment = async () => {
    if (!form.current?.reportValidity()) return false
    const result = await prepareQuickCheckout(new FormData(form.current), accepted, marketingAccepted)
    prepared.current = result
    if ("marketingMessage" in result && result.marketingMessage) setMarketingMessage(result.marketingMessage)
    return true
  }

  return <div className="space-y-8" data-testid="quick-checkout">
    {!paymentOpen && <div className="rounded-lg border border-[#ddcec0] p-4 small:hidden" aria-label="הספרים בהזמנה">
      <ul className="space-y-2">{cart.items?.map(item => <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
        <span>{item.title}</span><span className="shrink-0">כמות: {item.quantity}</span>
      </li>)}</ul>
    </div>}
    {!paymentOpen && <form ref={form} id={FORM_ID} data-testid="shipping-address-form" onSubmit={event => event.preventDefault()}>
      <fieldset disabled={submitting} className="min-w-0 space-y-8">
        <section className="space-y-5" aria-labelledby="checkout-details-heading">
          <Heading level="h2" id="checkout-details-heading" className="text-2xl font-semibold">פרטי ההזמנה</Heading>
          {!customer && <div className="space-y-3">
            <GoogleAuthButton label="כניסה עם Google" preserveCheckoutDraft />
            <LocalizedClientLink href={`/account?return_to=${encodeURIComponent(pathname)}`} className="inline-block text-sm underline">כניסה לחשבון</LocalizedClientLink>
          </div>}
          <ShippingAddress cart={cart} customer={customer} checked={sameAsBilling}
            onChange={() => setSameAsBilling(value => !value)} oauthDraft={oauthDraft} />
          {!sameAsBilling && <div className="space-y-4"><Heading level="h2" className="text-xl font-semibold">כתובת לחיוב</Heading>
            <BillingAddress cart={cart} customer={customer} oauthDraft={oauthDraft} /></div>}
        </section>
        <Shipping cart={cart} availableShippingMethods={shippingMethods} inline disabled={submitting} onLoadingChange={setShippingLoading} />
        <section className="space-y-4" aria-labelledby="payment-options-heading" data-testid="payment-options">
          <Heading level="h2" id="payment-options-heading" className="text-2xl font-semibold">אופן התשלום</Heading>
          <input type="hidden" name="installments" value={chosenInstallments} />
          {maxCount > 1 ? <div className="space-y-3" role="radiogroup" aria-labelledby="payment-options-heading">
            <label className={optionCard(paymentMode === "single")}>
              <input type="radio" name="payment_mode" value="single" checked={paymentMode === "single"}
                onChange={() => setPaymentMode("single")} className="mt-1 h-5 w-5 shrink-0 accent-[#4a2d21]" />
              <span><span className="block text-lg font-semibold">{`תשלום אחד של ${money(cart.total ?? 0)}`}</span>
                <span className="block text-sm">{paymentMethodsText(paymentOptions?.wallets)}</span></span>
            </label>
            <label className={optionCard(paymentMode === "installments")}>
              <input type="radio" name="payment_mode" value="installments" checked={paymentMode === "installments"}
                onChange={() => setPaymentMode("installments")} className="mt-1 h-5 w-5 shrink-0 accent-[#4a2d21]" />
              <span><span className="block text-lg font-semibold">חלוקה לתשלומים</span>
                <span className="block text-sm">{`עד ${maxCount} תשלומים, בכרטיס אשראי בלבד`}</span></span>
            </label>
            {paymentMode === "installments" && <div className="space-y-2" data-testid="installments-field">
              <label htmlFor="checkout-installments" className="block font-semibold">מספר תשלומים</label>
              <select id="checkout-installments" value={chosenInstallments}
                onChange={event => setInstallments(Number(event.target.value))}
                className="w-full rounded-md border-2 border-[#68462f] bg-white p-3 text-base">
                {Array.from({ length: maxCount - 1 }, (_, index) => index + 2).map(count => <option key={count} value={count}>
                  {installmentLabel(installmentPlan(cart.total, count), money)}
                </option>)}
              </select>
            </div>}
          </div> : <p className="text-base" data-testid="payment-methods-note">
            {`אפשר לשלם ${paymentMethodsText(paymentOptions?.wallets)}.`}
          </p>}
        </section>
        <div className="space-y-4 border-t border-[#ddcec0] pt-6">
          <label htmlFor="checkout-terms-consent" className="flex items-start gap-3 text-sm leading-7">
            <input id="checkout-terms-consent" name="checkout_terms" type="checkbox" required checked={accepted}
              onChange={event => setAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#4a2d21]" />
            <span>אני מאשר/ת שקראתי והסכמתי ל<a className="underline" href="/il/pages/terms-of-purchase" target="_blank" rel="noopener noreferrer">תקנון ותנאי הרכישה</a>,{" "}
              ל<a className="underline" href="/il/pages/shipping-returns" target="_blank" rel="noopener noreferrer">מדיניות המשלוחים, הביטולים וההחזרות</a>{" "}
              ול<a className="underline" href="/il/pages/privacy-accessibility" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות</a>.</span>
          </label>
          <MarketingCheckbox checked={marketingAccepted} onChange={setMarketingAccepted} disabled={submitting} />
        </div>
      </fieldset>
    </form>}
    <section ref={paymentSection} className="scroll-mt-6" aria-label="תשלום">
      {!paymentOpen && <div className="mb-5 flex items-center justify-between gap-4 text-lg font-semibold">
        <span>סה״כ לתשלום</span><span>{convertToLocale({ amount: cart.total ?? 0, currency_code: cart.currency_code })}</span>
      </div>}
      {marketingMessage && <p role="status" className="mb-4 text-sm">{marketingMessage}</p>}
      <NedarimPaymentButton notReady={shippingLoading} beforePayment={beforePayment} onSubmittingChange={setSubmitting}
        checkoutPaused={checkoutPaused} formId={FORM_ID} onPaymentStarted={() => setPaymentOpen(true)}
        onPaymentClosed={() => setPaymentOpen(false)}
        loadPayment={async () => {
          if (!prepared.current) throw new Error("לא ניתן לפתוח את התשלום כרגע.")
          return prepared.current
        }} />
    </section>
  </div>
}
