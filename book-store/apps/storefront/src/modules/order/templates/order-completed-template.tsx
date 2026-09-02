import { Heading } from "@modules/common/components/ui"
import { cookies as nextCookies } from "next/headers"

import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"
import { retrieveCustomer } from "@lib/data/customer"
import GoogleAuthButton from "@modules/account/components/google-auth-button"
import SaveCheckoutDetailsButton from "@modules/account/components/save-checkout-details-button"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()
  const customer = await retrieveCustomer()

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"
  const shippingMetadata = (order.shipping_address?.metadata || {}) as Record<
    string,
    unknown
  >
  const checkoutDraftValues: Record<string, string> = {
    email: order.email || "",
    "shipping_address.first_name": order.shipping_address?.first_name || "",
    "shipping_address.last_name": order.shipping_address?.last_name || "",
    "shipping_address.phone": order.shipping_address?.phone || "",
    "shipping_address.street": String(
      shippingMetadata.street || order.shipping_address?.address_1 || ""
    ),
    "shipping_address.house_number": String(shippingMetadata.house_number || ""),
    "shipping_address.apartment": String(shippingMetadata.apartment || ""),
    "shipping_address.floor": String(shippingMetadata.floor || ""),
    "shipping_address.city": order.shipping_address?.city || "",
    "shipping_address.postal_code": order.shipping_address?.postal_code || "",
    "shipping_address.country_code": order.shipping_address?.country_code || "",
  }
  const returnTo = `/${order.shipping_address?.country_code?.toLowerCase() || "il"}/order/${order.id}/confirmed`

  return (
    <div className="py-6 min-h-[calc(100vh-64px)]">
      <div className="content-container flex flex-col justify-center items-center gap-y-10 max-w-4xl h-full w-full">
        {isOnboarding && <OnboardingCta orderId={order.id} />}
        <div
          className="flex flex-col gap-4 max-w-4xl h-full bg-white w-full px-5 py-8 small:px-10 small:py-10"
          data-testid="order-complete-container"
        >
          <Heading
            level="h1"
            className="flex flex-col gap-y-3 text-ui-fg-base text-3xl mb-4"
          >
            <span>תודה רבה!</span>
            <span>ההזמנה התקבלה בהצלחה.</span>
          </Heading>
          <OrderDetails order={order} />
          {!customer && (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-5">
              <p className="mb-3 text-center text-small-regular text-ui-fg-subtle">
                רוצים לחסוך את מילוי הפרטים בהזמנה הבאה?
              </p>
              <div className="grid gap-3 small:grid-cols-2">
                <SaveCheckoutDetailsButton
                  values={checkoutDraftValues}
                  sameAsBilling={true}
                  sourceType="order"
                  sourceId={order.id}
                  returnTo={returnTo}
                />
                <GoogleAuthButton label="שמור עם Google" />
              </div>
            </div>
          )}
          <Heading level="h2" className="flex flex-row text-3xl-regular">
            סיכום ההזמנה
          </Heading>
          <Items order={order} />
          <CartTotals totals={order} />
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </div>
      </div>
    </div>
  )
}
