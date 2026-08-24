"use client"

import { usePathname, useSearchParams } from "next/navigation"
import Google from "@modules/common/icons/google"

const CHECKOUT_DRAFT_KEY = "checkout_google_oauth_draft"

const GoogleAuthButton = ({
  label = "המשך עם Google",
  preserveCheckoutDraft = false,
}: {
  label?: string
  preserveCheckoutDraft?: boolean
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const startGoogleLogin = () => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("google_auth_error")
    const returnTo = `${pathname}${nextParams.size ? `?${nextParams}` : ""}`

    if (preserveCheckoutDraft) {
      const form = document.querySelector<HTMLFormElement>(
        '[data-testid="shipping-address-form"]'
      )

      if (form) {
        const values: Record<string, string> = {}
        new FormData(form).forEach((value, key) => {
          if (typeof value === "string") values[key] = value
        })
        const sameAsBilling = form.querySelector<HTMLInputElement>(
          'input[name="same_as_billing"]'
        )?.checked

        sessionStorage.setItem(
          CHECKOUT_DRAFT_KEY,
          JSON.stringify({ values, sameAsBilling })
        )
      }
    }

    window.location.assign(
      `/api/auth/google?return_to=${encodeURIComponent(returnTo)}`
    )
  }

  const authError = searchParams.get("google_auth_error")

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={startGoogleLogin}
        className="w-full h-11 px-4 rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-base txt-compact-medium-plus hover:bg-ui-bg-base-hover focus:outline-none focus:shadow-borders-focus transition-colors"
        data-testid="google-auth-button"
      >
        <span dir="ltr" className="flex items-center justify-center gap-2.5">
          <Google />
          <span dir="rtl">{label}</span>
        </span>
      </button>
      {authError && (
        <p
          role="alert"
          className="mt-2 text-center text-small-regular text-rose-600"
          data-testid="google-auth-error"
        >
          {authError === "cancelled"
            ? "הכניסה באמצעות Google בוטלה."
            : "לא הצלחנו להתחבר באמצעות Google. אפשר לנסות שוב או להמשיך ללא התחברות."}
        </p>
      )}
    </div>
  )
}

export { CHECKOUT_DRAFT_KEY }
export default GoogleAuthButton
