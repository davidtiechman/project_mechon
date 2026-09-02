"use client"

import { loginWithEmailOtp, requestEmailOtp } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { safeReturnPath } from "@lib/util/safe-return-path"

export default function EmailOtp({ setCurrentView }: { setCurrentView: (view: LOGIN_VIEW) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get("return_to"), "/il/account")
  const [requestState, requestAction] = useActionState(requestEmailOtp, null)
  const [loginState, loginAction] = useActionState(loginWithEmailOtp, null)
  const [email, setEmail] = useState("")
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (requestState?.state === "code_sent") {
      setEmail(requestState.email)
      setRemaining(60)
    }
  }, [requestState])
  useEffect(() => {
    if (!remaining) return
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [remaining])
  useEffect(() => {
    if (loginState?.state === "success") router.replace(returnTo)
  }, [loginState, returnTo, router])

  const codeSent = requestState?.state === "code_sent"
  return <div className="max-w-sm w-full flex flex-col items-center">
    <h1 className="text-large-semi mb-6">כניסה באמצעות קוד למייל</h1>
    {!codeSent ? <form action={requestAction} className="w-full">
      <Input label="דוא״ל" name="email" type="email" autoComplete="email" required />
      <ErrorMessage error={requestState?.state === "error" ? requestState.error : null} />
      <SubmitButton className="w-full mt-6">שליחת קוד</SubmitButton>
    </form> : <>
      <p role="status" aria-live="polite" className="text-center mb-4">אם קיים חשבון עבור כתובת המייל הזו, נשלח אליו קוד כניסה. הקוד תקף ל־10 דקות.</p>
      <form action={loginAction} className="w-full">
        <input type="hidden" name="email" value={email} />
        <Input label="קוד בן 6 ספרות" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required />
        <ErrorMessage error={loginState?.state === "error" ? loginState.error : null} />
        <SubmitButton className="w-full mt-6">כניסה לחשבון</SubmitButton>
      </form>
      <form action={requestAction} className="w-full mt-4">
        <input type="hidden" name="email" value={email} />
        <SubmitButton className="w-full" disabled={remaining > 0}>
          {remaining > 0 ? `שליחת קוד חדש בעוד ${remaining} שניות` : "שליחת קוד חדש"}
        </SubmitButton>
      </form>
    </>}
    <button type="button" className="underline mt-6" onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}>חזרה לכניסה רגילה</button>
  </div>
}
