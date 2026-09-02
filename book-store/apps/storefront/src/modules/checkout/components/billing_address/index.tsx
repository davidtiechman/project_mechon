import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import React, { useEffect, useState } from "react"
import CountrySelect from "../country-select"

const BillingAddress = ({
  cart,
  customer,
  oauthDraft,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  oauthDraft?: Record<string, string>
}) => {
  const defaultBillingAddress =
    customer?.addresses?.find((address) => address.is_default_billing) ||
    customer?.addresses?.[0]
  const initialBillingAddress = cart?.billing_address?.address_1
    ? cart.billing_address
    : defaultBillingAddress
  const [formData, setFormData] = useState<Record<string, string>>({
    "billing_address.first_name": initialBillingAddress?.first_name || customer?.first_name || "",
    "billing_address.last_name": initialBillingAddress?.last_name || customer?.last_name || "",
    "billing_address.address_1": initialBillingAddress?.address_1 || "",
    "billing_address.company": initialBillingAddress?.company || "",
    "billing_address.postal_code": initialBillingAddress?.postal_code || "",
    "billing_address.city": initialBillingAddress?.city || "",
    "billing_address.country_code": initialBillingAddress?.country_code || "",
    "billing_address.province": initialBillingAddress?.province || "",
    "billing_address.phone": initialBillingAddress?.phone || customer?.phone || "",
  })

  useEffect(() => {
    if (!oauthDraft) return

    setFormData((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(oauthDraft).filter(([key]) =>
          key.startsWith("billing_address.")
        )
      ),
    }))
  }, [oauthDraft])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="שם פרטי"
          name="billing_address.first_name"
          autoComplete="given-name"
          value={formData["billing_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="billing-first-name-input"
        />
        <Input
          label="שם משפחה"
          name="billing_address.last_name"
          autoComplete="family-name"
          value={formData["billing_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="billing-last-name-input"
        />
        <Input
          label="כתובת"
          name="billing_address.address_1"
          autoComplete="address-line1"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="billing-address-input"
        />
        <Input
          label="חברה"
          name="billing_address.company"
          value={formData["billing_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="billing-company-input"
        />
        <Input
          label="מיקוד"
          name="billing_address.postal_code"
          autoComplete="postal-code"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="billing-postal-input"
        />
        <Input
          label="עיר"
          name="billing_address.city"
          autoComplete="address-level2"
          value={formData["billing_address.city"]}
          onChange={handleChange}
        />
        <CountrySelect
          name="billing_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["billing_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="billing-country-select"
        />
        <Input
          label="מחוז"
          name="billing_address.province"
          autoComplete="address-level1"
          value={formData["billing_address.province"]}
          onChange={handleChange}
          data-testid="billing-province-input"
        />
        <Input
          label="טלפון"
          name="billing_address.phone"
          autoComplete="tel"
          value={formData["billing_address.phone"]}
          onChange={handleChange}
          data-testid="billing-phone-input"
        />
      </div>
    </>
  )
}

export default BillingAddress
