"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import EmailOtp from "@modules/account/components/email-otp"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
  EMAIL_OTP = "email-otp",
}

const LoginTemplate = () => {
  const searchParams = useSearchParams()
  const initialView =
    searchParams.get("view") === LOGIN_VIEW.REGISTER
      ? LOGIN_VIEW.REGISTER
      : LOGIN_VIEW.SIGN_IN
  const [currentView, setCurrentView] = useState(initialView)

  return (
    <div className="w-full flex justify-start px-8 py-8">
      {currentView === LOGIN_VIEW.SIGN_IN ? (
        <Login setCurrentView={setCurrentView} />
      ) : currentView === LOGIN_VIEW.EMAIL_OTP ? (
        <EmailOtp setCurrentView={setCurrentView} />
      ) : (
        <Register setCurrentView={setCurrentView} />
      )}
    </div>
  )
}

export default LoginTemplate
