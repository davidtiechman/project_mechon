import { retrieveCustomer } from "@lib/data/customer"
// TODO: Re-add Toaster component when needed
import AccountLayout from "@modules/account/templates/account-layout"
import { privatePageRobots } from "@lib/util/seo"
import type { Metadata } from "next"
import AccountLoadError from "@modules/account/components/account-load-error"

export const metadata: Metadata = { robots: privatePageRobots }

export default async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: React.ReactNode
  login?: React.ReactNode
}) {
  let customer
  try {
    customer = await retrieveCustomer({ throwOnError: true })
  } catch {
    return (
      <AccountLayout customer={null}>
        <AccountLoadError />
      </AccountLayout>
    )
  }

  return (
    <AccountLayout customer={customer}>
      {customer ? dashboard : login}
      {/* TODO: Re-add Toaster component when needed */}
    </AccountLayout>
  )
}
