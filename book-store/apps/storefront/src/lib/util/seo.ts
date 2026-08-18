import type { Metadata } from "next"

export function getIndexableLocales() {
  return (process.env.NEXT_PUBLIC_INDEXABLE_LOCALES || "il")
    .split(",")
    .map((locale) => locale.trim().toLowerCase())
    .filter(Boolean)
}

export function isIndexableLocale(countryCode: string) {
  return getIndexableLocales().includes(countryCode.toLowerCase())
}

export function localizedPath(countryCode: string, path = "") {
  const locale = countryCode.toLowerCase()
  const suffix = path && path !== "/" ? `/${path.replace(/^\/+|\/+$/g, "")}` : ""

  return `/${locale}${suffix}`
}

export function canonicalMetadata(
  countryCode: string,
  path = ""
): Metadata["alternates"] {
  const locales = getIndexableLocales()
  const locale = locales.includes(countryCode.toLowerCase())
    ? countryCode
    : locales[0]

  return { canonical: localizedPath(locale, path) }
}

export const privatePageRobots: Metadata["robots"] = {
  index: false,
  follow: true,
}
