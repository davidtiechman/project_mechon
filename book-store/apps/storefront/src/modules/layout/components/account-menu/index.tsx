import { cookies } from "next/headers"
import { retrieveCustomer } from "@lib/data/customer"
import {
  GOOGLE_AVATAR_METADATA_KEY,
  googlePictureFromToken,
  safeGooglePicture,
} from "@lib/util/google-avatar"
import AccountDropdown from "./account-dropdown"

export default async function AccountMenu() {
  const customer = await retrieveCustomer({
    fields: "id,first_name,last_name,email,metadata",
  }).catch(() => null)

  // Saved on Google login; older Google sessions still carry it in the login token
  const avatarUrl = customer
    ? safeGooglePicture(customer.metadata?.[GOOGLE_AVATAR_METADATA_KEY]) ||
      googlePictureFromToken((await cookies()).get("_medusa_jwt")?.value)
    : undefined

  return (
    <AccountDropdown
      account={customer ? {
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        avatarUrl: avatarUrl || null,
      } : null}
    />
  )
}
