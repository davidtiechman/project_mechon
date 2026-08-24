import { HttpTypes } from "@medusajs/types"
import Checkbox from "@modules/common/components/checkbox"
import { Container } from "@modules/common/components/ui"
import Input from "@modules/common/components/input"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useState } from "react"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"
import type { IsraeliCity, IsraeliStreet } from "@lib/israel-addresses"
import {
  getEmailTypoSuggestion,
  isValidEmail,
  isValidIsraeliPhone,
  isValidOptionalIsraeliPostalCode,
} from "@lib/util/checkout-validation"

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
    "shipping_address.floor": String(addressMetadata.floor || ""),
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
  const [cities, setCities] = useState<IsraeliCity[]>([])
  const [streets, setStreets] = useState<IsraeliStreet[]>([])
  const [cityCode, setCityCode] = useState("")
  const [streetCode, setStreetCode] = useState("")
  const [streetsLoading, setStreetsLoading] = useState(false)
  const [manualStreet, setManualStreet] = useState(false)

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region],
  )
  const showCountrySelect = (countriesInRegion?.length || 0) > 1
  const selectedCountry = formData["shipping_address.country_code"]
  const showProvince = selectedCountry !== "il"
  const emailSuggestion = getEmailTypoSuggestion(formData.email)

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
        "shipping_address.floor": String(address?.metadata?.floor || ""),
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

  useEffect(() => {
    const query = formData["shipping_address.city"].trim()
    if (selectedCountry !== "il" || query.length < 1) {
      setCities([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/israel-addresses/cities?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        )
        const data = (await response.json()) as { cities?: IsraeliCity[] }
        setCities(data.cities || [])
      } catch (error) {
        if ((error as Error).name !== "AbortError") setCities([])
      }
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [formData["shipping_address.city"], selectedCountry])

  useEffect(() => {
    if (!cityCode) {
      const exactCity = cities.find(
        (city) => city.name === formData["shipping_address.city"].trim(),
      )
      if (exactCity) setCityCode(String(exactCity.code))
    }
  }, [cities, cityCode, formData])

  useEffect(() => {
    if (!cityCode || selectedCountry !== "il") {
      setStreets([])
      return
    }
    const controller = new AbortController()
    setStreetsLoading(true)
    setManualStreet(false)
    fetch(`/api/israel-addresses/streets?cityCode=${cityCode}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: { streets?: IsraeliStreet[] }) => {
        const nextStreets = data.streets || []
        setStreets(nextStreets)
        setManualStreet(nextStreets.length === 0)
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setStreets([])
          setManualStreet(true)
        }
      })
      .finally(() => setStreetsLoading(false))
    return () => controller.abort()
  }, [cityCode, selectedCountry])

  useEffect(() => {
    if (!streetCode) {
      const exactStreet = streets.find(
        (street) => street.name === formData["shipping_address.street"].trim(),
      )
      if (exactStreet) setStreetCode(String(exactStreet.code))
    }
  }, [streets, streetCode, formData])

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

  const handleCityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    const city = cities.find((candidate) => candidate.name === value)
    setCityCode(city ? String(city.code) : "")
    setStreetCode("")
    setStreets([])
    setManualStreet(false)
    setFormData((current) => ({
      ...current,
      "shipping_address.city": value,
      "shipping_address.street": "",
    }))
  }

  const handleStreetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    const street = streets.find((candidate) => candidate.name === value)
    setStreetCode(street ? String(street.code) : "")
    setFormData((current) => ({ ...current, "shipping_address.street": value }))
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
        <div>
          <Input
            label="עיר"
            name="shipping_address.city"
            list={selectedCountry === "il" ? "israeli-cities" : undefined}
            autoComplete="address-level2"
            value={formData["shipping_address.city"]}
            onChange={
              selectedCountry === "il" ? handleCityChange : handleChange
            }
            required
            onInvalid={(event) =>
              event.currentTarget.setCustomValidity("יש לבחור עיר")
            }
            onInput={(event) => event.currentTarget.setCustomValidity("")}
            data-testid="shipping-city-input"
          />
          <input
            type="hidden"
            name="shipping_address.city_code"
            value={cityCode}
          />
          <datalist id="israeli-cities">
            {cities.map((city) => (
              <option key={city.code} value={city.name} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Input
            label={streetsLoading ? "טוען רחובות..." : "רחוב"}
            name="shipping_address.street"
            list={
              selectedCountry === "il" && !manualStreet
                ? "israeli-streets"
                : undefined
            }
            autoComplete="address-line1"
            value={formData["shipping_address.street"]}
            onChange={
              selectedCountry === "il" ? handleStreetChange : handleChange
            }
            disabled={selectedCountry === "il" && streetsLoading}
            required
            onInvalid={(event) =>
              event.currentTarget.setCustomValidity("יש לבחור רחוב")
            }
            onInput={(event) => event.currentTarget.setCustomValidity("")}
            data-testid="shipping-address-input"
          />
          <input
            type="hidden"
            name="shipping_address.street_code"
            value={streetCode}
          />
          <datalist id="israeli-streets">
            {streets.map((street) => (
              <option key={street.code} value={street.name} />
            ))}
          </datalist>
          {manualStreet && cityCode && (
            <span className="txt-compact-small text-ui-fg-muted">
              לא נמצאה רשימת רחובות; אפשר להזין רחוב ידנית.
            </span>
          )}
        </div>
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
          label="קומה"
          name="shipping_address.floor"
          value={formData["shipping_address.floor"]}
          onChange={handleChange}
          data-testid="shipping-floor-input"
        />
        <Input
          label="מיקוד"
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          required={selectedCountry !== "il"}
          inputMode="numeric"
          onBlur={(event) =>
            event.currentTarget.setCustomValidity(
              selectedCountry !== "il" ||
                isValidOptionalIsraeliPostalCode(event.currentTarget.value)
                ? ""
                : "המיקוד צריך להכיל 7 ספרות",
            )
          }
          onInvalid={(event) =>
            event.currentTarget.setCustomValidity("המיקוד צריך להכיל 7 ספרות")
          }
          onInput={(event) => {
            event.currentTarget.setCustomValidity(
              selectedCountry !== "il" ||
                isValidOptionalIsraeliPostalCode(event.currentTarget.value)
                ? ""
                : "המיקוד צריך להכיל 7 ספרות",
            )
          }}
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
          label="טלפון"
          name="shipping_address.phone"
          autoComplete="tel"
          inputMode="tel"
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          required
          onBlur={(event) =>
            event.currentTarget.setCustomValidity(
              selectedCountry !== "il" ||
                isValidIsraeliPhone(event.currentTarget.value)
                ? ""
                : "מספר הטלפון אינו תקין",
            )
          }
          onInvalid={(event) =>
            event.currentTarget.setCustomValidity("מספר הטלפון אינו תקין")
          }
          onInput={(event) =>
            event.currentTarget.setCustomValidity(
              selectedCountry !== "il" ||
                isValidIsraeliPhone(event.currentTarget.value)
                ? ""
                : "מספר הטלפון אינו תקין",
            )
          }
          data-testid="shipping-phone-input"
        />
        <div className="flex flex-col gap-1">
          <Input
            label="דוא״ל"
            name="email"
            type="email"
            title="כתובת האימייל אינה תקינה"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            required
            onBlur={(event) =>
              event.currentTarget.setCustomValidity(
                isValidEmail(event.currentTarget.value)
                  ? ""
                  : "כתובת האימייל אינה תקינה",
              )
            }
            onInvalid={(event) =>
              event.currentTarget.setCustomValidity("כתובת האימייל אינה תקינה")
            }
            onInput={(event) =>
              event.currentTarget.setCustomValidity(
                isValidEmail(event.currentTarget.value)
                  ? ""
                  : "כתובת האימייל אינה תקינה",
              )
            }
            data-testid="shipping-email-input"
          />
          {emailSuggestion && (
            <p
              className="txt-compact-small text-ui-fg-subtle"
              data-testid="shipping-email-suggestion"
            >
              האם התכוונת ל־
              <span dir="ltr" className="font-medium text-ui-fg-base">
                {emailSuggestion}
              </span>
              ?{" "}
              <button
                type="button"
                className="font-medium text-ui-fg-interactive hover:underline"
                onClick={() =>
                  setFormData((current) => ({
                    ...current,
                    email: emailSuggestion,
                  }))
                }
              >
                תקן
              </button>
            </p>
          )}
        </div>
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
