"use client"
import { selectSavedCustomerAddress, setAddresses } from "@lib/data/cart"
import useToggleState from "@lib/hooks/use-toggle-state"
import compareAddresses from "@lib/util/compare-addresses"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Divider from "@modules/common/components/divider"
import { Heading, Text } from "@modules/common/components/ui"
import Spinner from "@modules/common/icons/spinner"
import AuthDivider from "@modules/account/components/auth-divider"
import GoogleAuthButton, {
  CHECKOUT_DRAFT_KEY,
} from "@modules/account/components/google-auth-button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useEffect, useState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import SaveCheckoutDetailsButton from "@modules/account/components/save-checkout-details-button"

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const [oauthDraft, setOauthDraft] = useState<{
    values: Record<string, string>
    sameAsBilling?: boolean
  } | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "address"

  const {
    state: sameAsBilling,
    toggle: toggleSameAsBilling,
    open: selectSameBilling,
    close: selectSeparateBilling,
  } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart.shipping_address, cart.billing_address)
      : true,
  )

  useEffect(() => {
    try {
      const value = sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
      if (!value) return

      const draft = JSON.parse(value) as {
        values?: Record<string, string>
        sameAsBilling?: boolean
      }
      if (!draft.values || typeof draft.values !== "object") {
        sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
        return
      }
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
      setOauthDraft({
        values: draft.values,
        sameAsBilling: draft.sameAsBilling,
      })

      if (draft.sameAsBilling === true) selectSameBilling()
      if (draft.sameAsBilling === false) selectSeparateBilling()
    } catch {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
    }
    // The draft is intentionally consumed once after returning from OAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  const [message, formAction] = useActionState(setAddresses, null)
  const shippingMetadata = (cart?.shipping_address?.metadata || {}) as Record<
    string,
    unknown
  >
  const checkoutDraftValues: Record<string, string> = {
    email: cart?.email || "",
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    "shipping_address.street": String(
      shippingMetadata.street || cart?.shipping_address?.address_1 || ""
    ),
    "shipping_address.house_number": String(shippingMetadata.house_number || ""),
    "shipping_address.apartment": String(shippingMetadata.apartment || ""),
    "shipping_address.floor": String(shippingMetadata.floor || ""),
    "shipping_address.delivery_notes": String(shippingMetadata.delivery_notes || ""),
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.country_code": cart?.shipping_address?.country_code || "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
  }

  const handleSavedAddressSelected = async (
    address: HttpTypes.StoreCustomerAddress
  ) => {
    await selectSavedCustomerAddress(address.id, sameAsBilling)
    router.refresh()
  }

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          tabIndex={-1}
          data-checkout-step-heading="address"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
        >
          פרטי משלוח
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.shipping_address && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-address-button"
            >
              עריכה
            </button>
          </Text>
        )}
      </div>
      {isOpen ? (
        <form action={formAction} data-testid="shipping-address-form">
          <div className="pb-8">
            {!customer && (
              <>
                <p className="mb-3 text-center text-small-regular text-ui-fg-subtle">
                  כבר יש לכם חשבון?{" "}
                  <LocalizedClientLink
                    href={`/account?return_to=${encodeURIComponent(`${pathname}?step=address`)}`}
                    className="font-medium text-ui-fg-interactive underline"
                  >
                    התחברו
                  </LocalizedClientLink>
                </p>
                <GoogleAuthButton
                  label="המשך עם Google"
                  preserveCheckoutDraft
                />
                <AuthDivider />
                <p className="mb-6 text-center text-small-regular text-ui-fg-subtle">
                  אפשר להמשיך כאורחים ללא הרשמה.
                </p>
              </>
            )}
            <ShippingAddress
              customer={customer}
              cart={cart}
              oauthDraft={oauthDraft?.values}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              onSavedAddressSelected={handleSavedAddressSelected}
            />
            {!sameAsBilling && (
              <div>
                <Heading level="h2" className="text-3xl-regular pb-6 pt-8">
                  כתובת לחיוב
                </Heading>
                <BillingAddress
                  cart={cart}
                  customer={customer}
                  oauthDraft={oauthDraft?.values}
                />
              </div>
            )}
            <SubmitButton className="mt-6" data-testid="submit-address-button">
              המשך לבחירת משלוח
            </SubmitButton>
            <ErrorMessage error={message} data-testid="address-error-message" />
          </div>
        </form>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && cart.shipping_address ? (
              <div className="flex items-start gap-x-8">
                <div className="flex flex-col small:flex-row items-start gap-4 small:gap-x-8 w-full">
                  <div
                    className="flex flex-col w-full small:w-1/2"
                    data-testid="shipping-address-summary"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">
                      כתובת למשלוח
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.first_name}{" "}
                      {cart.shipping_address.last_name}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.address_1}{" "}
                      {cart.shipping_address.address_2}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.postal_code},{" "}
                      {cart.shipping_address.city}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.country_code?.toUpperCase()}
                    </Text>
                  </div>

                  <div
                    className="flex flex-col w-full small:w-1/2"
                    data-testid="shipping-contact-summary"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">
                      פרטי קשר
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.phone}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.email}
                    </Text>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Spinner />
              </div>
            )}
          </div>
          {!customer && (
            <div className="mt-6 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-5">
              <Text className="mb-3 text-center text-small-regular text-ui-fg-subtle">
                רוצים לחסוך את מילוי הפרטים בהזמנה הבאה?
              </Text>
              <div className="grid gap-3 small:grid-cols-2">
                <SaveCheckoutDetailsButton
                  values={checkoutDraftValues}
                  sameAsBilling={sameAsBilling}
                  sourceType="cart"
                  sourceId={cart?.id || ""}
                  returnTo={`${pathname}?step=delivery`}
                />
                <GoogleAuthButton label="שמור עם Google" />
              </div>
            </div>
          )}
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Addresses
