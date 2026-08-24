import { parsePhoneNumberFromString } from "libphonenumber-js"
import { z } from "zod"

export const isValidIsraeliPhone = (value: string) => {
  const phone = parsePhoneNumberFromString(value.trim(), "IL")
  return Boolean(phone?.isValid() && phone.country === "IL")
}

export const normalizeIsraeliPhone = (value: string) =>
  parsePhoneNumberFromString(value.trim(), "IL")?.format("E.164") ||
  value.trim()

export const isValidEmail = (value: string) =>
  z.email().safeParse(value.trim()).success

const COMMON_EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  "gmail.ocm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmail.co": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  gmailcom: "gmail.com",
  "outlook.ocm": "outlook.com",
  "outlook.con": "outlook.com",
  "outlok.com": "outlook.com",
  "hotmail.ocm": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.ocm": "yahoo.com",
  "icloud.con": "icloud.com",
  "icloud.ocm": "icloud.com",
}

export const getEmailTypoSuggestion = (value: string) => {
  const email = value.trim()
  const atIndex = email.indexOf("@")

  // Only suggest for an unambiguous address with a usable local part.
  if (
    atIndex <= 0 ||
    atIndex !== email.lastIndexOf("@") ||
    !/^[^\s@]+$/.test(email.slice(0, atIndex))
  ) {
    return null
  }

  const localPart = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1).toLowerCase()
  const correctedDomain = COMMON_EMAIL_DOMAIN_TYPOS[domain]

  return correctedDomain ? `${localPart}@${correctedDomain}` : null
}

export const normalizePostalCode = (value: string) =>
  value.replace(/[\s-]/g, "")

export const isValidOptionalIsraeliPostalCode = (value: string) => {
  const normalized = normalizePostalCode(value)
  return !normalized || /^\d{7}$/.test(normalized)
}
