"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@modules/common/components/ui"
import { confirmEmailVerification } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type VerificationState = "verifying" | "success" | "error"

const VerifyAccount = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerificationState>("verifying")
  // Guard against the effect running twice in React Strict Mode, which would
  // consume the single-use token before the customer sees the result.
  const confirmed = useRef(false)

  useEffect(() => {
    if (confirmed.current) {
      return
    }
    confirmed.current = true

    if (!token) {
      setState("error")
      return
    }

    confirmEmailVerification(token).then(({ success }) =>
      setState(success ? "success" : "error")
    )
  }, [token])

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center text-center gap-y-4"
      data-testid="verify-account-page"
    >
      <h1 className="text-large-semi">אימות כתובת הדוא״ל</h1>

      {state === "verifying" && (
        <p role="status" aria-live="polite" className="text-base-regular text-ui-fg-base">
          מאמתים את כתובת הדוא״ל שלך...
        </p>
      )}

      {state === "success" && (
        <>
          <p role="status" className="text-base-regular text-ui-fg-base">
            כתובת הדוא״ל אומתה בהצלחה. כעת אפשר להתחבר לחשבון.
          </p>
          <LocalizedClientLink href="/account">
            <Button variant="primary">מעבר להתחברות</Button>
          </LocalizedClientLink>
        </>
      )}

      {state === "error" && (
        <>
          <p role="alert" className="text-base-regular text-ui-fg-base">
            קישור האימות אינו תקין או שפג תוקפו. יש להתחבר כדי לקבל הודעת אימות חדשה.
          </p>
          <LocalizedClientLink href="/account">
            <Button variant="secondary">מעבר להתחברות</Button>
          </LocalizedClientLink>
        </>
      )}
    </div>
  )
}

export default VerifyAccount
