"use client"

import { CHECKOUT_DRAFT_KEY } from "../google-auth-button"
import { usePathname, useRouter } from "next/navigation"

export default function SaveCheckoutDetailsButton({
  values,
  sameAsBilling,
  sourceType,
  sourceId,
  returnTo,
}: {
  values: Record<string, string>
  sameAsBilling: boolean
  sourceType: "cart" | "order"
  sourceId: string
  returnTo: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  const startRegistration = () => {
    sessionStorage.setItem(
      CHECKOUT_DRAFT_KEY,
      JSON.stringify({ values, sameAsBilling })
    )

    const countryCode = pathname.split("/").filter(Boolean)[0] || "il"
    const params = new URLSearchParams({
      view: "register",
      return_to: returnTo,
      checkout_source_type: sourceType,
      checkout_source_id: sourceId,
    })
    router.push(`/${countryCode}/account?${params}`)
  }

  return (
    <button
      type="button"
      onClick={startRegistration}
      className="h-11 w-full rounded-md bg-[#6b5339] px-4 font-medium text-white transition-colors hover:bg-[#58432e] focus:outline-none focus:ring-2 focus:ring-[#8a6f4d] focus:ring-offset-2"
    >
      שמור את הפרטים
    </button>
  )
}

