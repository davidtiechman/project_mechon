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

export const normalizePostalCode = (value: string) =>
  value.replace(/[\s-]/g, "")

export const isValidOptionalIsraeliPostalCode = (value: string) => {
  const normalized = normalizePostalCode(value)
  return !normalized || /^\d{7}$/.test(normalized)
}
