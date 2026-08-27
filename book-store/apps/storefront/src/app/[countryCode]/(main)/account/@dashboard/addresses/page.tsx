import { Metadata } from "next"
import { notFound } from "next/navigation"

import AddressBook from "@modules/account/components/address-book"

import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "כתובות",
  description: "צפייה וניהול של כתובות המשלוח",
}

export default async function Addresses(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params
  const customer = await retrieveCustomer()
  const region = await getRegion(countryCode)

  if (!customer || !region) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="addresses-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">כתובות משלוח</h1>
        <p className="text-base-regular">
          כאן ניתן לצפות בכתובות המשלוח, לעדכן אותן ולהוסיף כתובות חדשות.
          הכתובות השמורות יהיו זמינות בעת ביצוע ההזמנה.
        </p>
      </div>
      <AddressBook customer={customer} region={region} />
    </div>
  )
}
