"use client"

import React from "react"
import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { getCustomerPasswordStatus, updateCustomerPassword } from "@lib/data/customer"

export default function ProfilePassword({ customer: _customer }: { customer: HttpTypes.StoreCustomer }) {
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [hasPassword, setHasPassword] = React.useState<boolean | null>(null)
  React.useEffect(() => { void getCustomerPasswordStatus().then(setHasPassword) }, [])

  const updatePassword = async (formData: FormData) => {
    setError(undefined)
    const result = await updateCustomerPassword(null, formData)
    setSuccess(result.success)
    setError(result.error)
    if (result.success) setHasPassword(true)
  }

  return <form action={updatePassword} onReset={() => { setSuccess(false); setError(undefined) }} className="w-full">
    <AccountInfo label={hasPassword === false ? "הגדרת סיסמה" : "שינוי סיסמה"} currentInfo={<span>הסיסמה אינה מוצגת מטעמי אבטחה</span>} isSuccess={success} isError={Boolean(error)} errorMessage={error} clearState={() => { setSuccess(false); setError(undefined) }} data-testid="account-password-editor">
      <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
        {hasPassword !== false && <Input label="סיסמה נוכחית" name="old_password" required type="password" autoComplete="current-password" data-testid="old-password-input" />}
        <Input label="סיסמה חדשה" type="password" name="new_password" minLength={8} maxLength={128} required autoComplete="new-password" data-testid="new-password-input" />
        <Input label="אימות סיסמה חדשה" type="password" name="confirm_password" minLength={8} maxLength={128} required autoComplete="new-password" data-testid="confirm-password-input" />
      </div>
    </AccountInfo>
  </form>
}
