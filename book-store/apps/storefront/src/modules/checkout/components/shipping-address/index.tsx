import { HttpTypes } from "@medusajs/types"
import Checkbox from "@modules/common/components/checkbox"
import { Container } from "@modules/common/components/ui"
import Input from "@modules/common/components/input"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const addressMetadata = (cart?.shipping_address?.metadata || {}) as Record<
    string,
    unknown
  >
  const [formData, setFormData] = useState<Record<string, string>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.street":
      String(addressMetadata.street || "") ||
      cart?.shipping_address?.address_1 ||
      "",
    "shipping_address.house_number": String(addressMetadata.house_number || ""),
    "shipping_address.apartment": String(addressMetadata.apartment || ""),
    "shipping_address.delivery_notes": String(
      addressMetadata.delivery_notes || "",
    ),
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code":
      cart?.shipping_address?.country_code ||
      cart?.region?.countries?.[0]?.iso_2 ||
      "",
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    email: cart?.email || "",
  })

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region],
  )
  const showCountrySelect = (countriesInRegion?.length || 0) > 1
  const selectedCountry = formData["shipping_address.country_code"]
  const showProvince = selectedCountry !== "il"

  // check if customer has saved addresses that are in the current region
  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code),
      ),
    [customer?.addresses, countriesInRegion],
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string,
  ) => {
    if (address) {
      setFormData((prevState: Record<string, string>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.street":
          String(address?.metadata?.street || "") || address?.address_1 || "",
        "shipping_address.house_number": String(
          address?.metadata?.house_number || "",
        ),
        "shipping_address.apartment": String(
          address?.metadata?.apartment || "",
        ),
        "shipping_address.delivery_notes": String(
          address?.metadata?.delivery_notes || "",
        ),
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": address?.country_code || "",
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
      }))
    }

    if (email) {
      setFormData((prevState: Record<string, string>) => ({
        ...prevState,
        email: email,
      }))
    }
  }

  useEffect(() => {
    // Ensure cart is not null and has a shipping_address before setting form data
    if (cart && cart.shipping_address) {
      setFormAddress(cart?.shipping_address, cart?.email)
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
    }
  }, [cart]) // Add cart as a dependency

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-5">
          <p className="text-small-regular">
            {`שלום ${customer.first_name || ""}, אפשר לבחור כתובת שמורה:`}
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={
              mapKeys(formData, (_, key) =>
                key.replace("shipping_address.", ""),
              ) as unknown as HttpTypes.StoreCartAddress
            }
            onSelect={setFormAddress}
          />
        </Container>
      )}
      <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
        <Input
          label="שם פרטי"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label="שם משפחה"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
        />
        <Input
          label="רחוב"
          name="shipping_address.street"
          autoComplete="address-line1"
          value={formData["shipping_address.street"]}
          onChange={handleChange}
          required
          data-testid="shipping-address-input"
        />
        <Input
          label="מספר בית"
          name="shipping_address.house_number"
          value={formData["shipping_address.house_number"]}
          onChange={handleChange}
          required
          data-testid="shipping-house-number-input"
        />
        <Input
          label="מספר דירה"
          name="shipping_address.apartment"
          value={formData["shipping_address.apartment"]}
          onChange={handleChange}
          data-testid="shipping-apartment-input"
        />
        <Input
          label="עיר"
          name="shipping_address.city"
          autoComplete="address-level2"
          value={formData["shipping_address.city"]}
          onChange={handleChange}
          required
          data-testid="shipping-city-input"
        />
        <Input
          label="מיקוד"
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          required={selectedCountry !== "il"}
          data-testid="shipping-postal-code-input"
        />
        {showCountrySelect ? (
          <CountrySelect
            name="shipping_address.country_code"
            autoComplete="country"
            region={cart?.region}
            value={selectedCountry}
            onChange={handleChange}
            required
            data-testid="shipping-country-select"
          />
        ) : (
          <input
            type="hidden"
            name="shipping_address.country_code"
            value={selectedCountry}
          />
        )}
        {showProvince && (
          <Input
            label="מחוז / מדינה"
            name="shipping_address.province"
            autoComplete="address-level1"
            value={formData["shipping_address.province"]}
            onChange={handleChange}
            data-testid="shipping-province-input"
          />
        )}
        <Input
          label="דוא״ל"
          name="email"
          type="email"
          title="יש להזין כתובת דוא״ל תקינה."
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          data-testid="shipping-email-input"
        />
        <Input
          label="טלפון"
          name="shipping_address.phone"
          autoComplete="tel"
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          required
          data-testid="shipping-phone-input"
        />
        <label className="flex flex-col gap-2 small:col-span-2 txt-compact-medium text-ui-fg-subtle">
          הערות למשלוח
          <textarea
            name="shipping_address.delivery_notes"
            value={formData["shipping_address.delivery_notes"]}
            onChange={handleChange}
            rows={3}
            className="block w-full resize-y rounded-md border border-ui-border-base bg-ui-bg-field px-4 py-3 text-ui-fg-base focus:outline-none focus:shadow-borders-interactive-with-active"
            data-testid="shipping-delivery-notes-input"
          />
        </label>
      </div>
      <div className="my-8">
        <Checkbox
          label="כתובת החיוב זהה לכתובת המשלוח"
          name="same_as_billing"
          checked={checked}
          onChange={onChange}
          data-testid="billing-address-checkbox"
        />
      </div>
    </>
  )
}

export default ShippingAddress
