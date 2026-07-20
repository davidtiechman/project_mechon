import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Sign in",
  description: "כניסה לחשבון באתר מכון מעשה רוקח.",
}

export default function Login() {
  return <LoginTemplate />
}
