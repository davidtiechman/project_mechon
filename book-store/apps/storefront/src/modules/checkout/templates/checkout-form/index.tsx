import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { getInstallmentPolicy } from "@lib/data/nedarim"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import CheckoutSteps from "@modules/checkout/components/checkout-steps"
import QuickCheckout from "@modules/checkout/components/quick-checkout"
import { isNedarim } from "@lib/constants"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) {
  if (!cart) {
    return null
  }

  const [shippingMethods, paymentMethods, installmentPolicy] = await Promise.all([
    listCartShippingMethods(cart.id),
    listCartPaymentMethods(cart.region?.id ?? ""),
    getInstallmentPolicy(),
  ])

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  // Address-dependent carrier quotes must keep the address-first flow.
  const fixedShipping = shippingMethods.every(option => option.price_type !== "calculated")
  if (paymentMethods.length === 1 && isNedarim(paymentMethods[0].id) && Number(cart.total) > 0 && fixedShipping) {
    return <QuickCheckout key={cart.id} cart={cart} customer={customer} shippingMethods={shippingMethods}
      checkoutPaused={process.env.NEXT_PUBLIC_NEDARIM_CHECKOUT_PAUSED === "true"} installmentPolicy={installmentPolicy} />
  }

  return (
    <div className="w-full grid grid-cols-1 gap-y-8">
      <CheckoutSteps />
      <Addresses cart={cart} customer={customer} />

      <Shipping cart={cart} availableShippingMethods={shippingMethods} />

      <Payment cart={cart} availablePaymentMethods={paymentMethods} />

      <Review cart={cart} />
    </div>
  )
}
