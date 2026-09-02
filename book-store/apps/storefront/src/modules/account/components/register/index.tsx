"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { safeReturnPath } from "@lib/util/safe-return-path"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import AuthDivider from "../auth-divider"
import GoogleAuthButton, { CHECKOUT_DRAFT_KEY } from "../google-auth-button"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get("return_to"), "/il/account")
  const sourceType = searchParams.get("checkout_source_type")
  const sourceId = searchParams.get("checkout_source_id") || ""
  const [checkoutValues, setCheckoutValues] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as { values?: Record<string, string> }
      if (draft.values && typeof draft.values === "object") {
        setCheckoutValues(draft.values)
      }
    } catch {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
    }
  }, [])

  useEffect(() => {
    if (message?.state === "success") {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
      router.replace(returnTo)
    }
  }, [message, returnTo, router])

  return (
    <div
      className="max-w-sm flex flex-col items-center"
      data-testid="register-page"
    >
      <h1 className="text-large-semi uppercase mb-6">
        הצטרפות למכון מעשה רוקח
      </h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-4">
        פתיחת חשבון תאפשר לך חוויית קנייה אישית, שמירת כתובות ומעקב אחר הזמנות.
      </p>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-4 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="register-verification-message"
        >
          שלחנו קישור אימות אל <strong>{message.email}</strong>. יש לפתוח את הקישור
          בתיבת הדואר ולאחר מכן להתחבר לחשבון.
        </div>
      )}
      <GoogleAuthButton />
      <AuthDivider />
      <form
        key={`${checkoutValues.email || ""}-${checkoutValues["shipping_address.first_name"] || ""}`}
        className="w-full flex flex-col"
        action={formAction}
      >
        <input type="hidden" name="return_to" value={returnTo} />
        <input
          type="hidden"
          name="checkout_source_type"
          value={sourceType === "cart" || sourceType === "order" ? sourceType : ""}
        />
        <input type="hidden" name="checkout_source_id" value={sourceId} />
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="שם פרטי"
            name="first_name"
            required
            autoComplete="given-name"
            defaultValue={checkoutValues["shipping_address.first_name"] || ""}
            data-testid="first-name-input"
          />
          <Input
            label="שם משפחה"
            name="last_name"
            required
            autoComplete="family-name"
            defaultValue={checkoutValues["shipping_address.last_name"] || ""}
            data-testid="last-name-input"
          />
          <Input
            label="דואר אלקטרוני"
            name="email"
            required
            type="email"
            autoComplete="email"
            defaultValue={checkoutValues.email || ""}
            data-testid="email-input"
          />
          <Input
            label="טלפון"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={checkoutValues["shipping_address.phone"] || ""}
            data-testid="phone-input"
          />
          <Input
            label="סיסמה"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="register-error"
        />
        <span className="text-center text-ui-fg-base text-small-regular mt-6">
          בפתיחת חשבון הנך מסכים/ה ל
          <LocalizedClientLink
            href="/pages/privacy"
            className="underline"
          >
            מדיניות הפרטיות
          </LocalizedClientLink>{" "}
          ול
          <LocalizedClientLink
            href="/pages/terms"
            className="underline"
          >
            תנאי השימוש
          </LocalizedClientLink>
          .
        </span>
        <SubmitButton className="w-full mt-6" data-testid="register-button">
          פתיחת חשבון
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        כבר יש לך חשבון?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="underline"
        >
          התחברות
        </button>
        .
      </span>
    </div>
  )
}

export default Register
