import { HttpTypes } from "@medusajs/types"

const HEBREW_FINAL_LETTERS: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
}

export const normalizeProductSearchText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[ךםןףץ]/g, (letter) => HEBREW_FINAL_LETTERS[letter] || letter)
    .toLocaleLowerCase("he")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

const flattenMetadata = (value: unknown): string[] => {
  if (value == null) return []
  if (typeof value === "string" || typeof value === "number") return [String(value)]
  if (Array.isArray(value)) return value.flatMap(flattenMetadata)
  if (typeof value === "object") return Object.values(value).flatMap(flattenMetadata)
  return []
}

export const getProductSearchParts = (
  product: HttpTypes.StoreProduct,
  extraTerms: string[] = []
) => [
  product.title,
  product.subtitle,
  product.description,
  product.collection?.title,
  ...(product.tags?.map((tag) => tag.value) || []),
  ...(product.categories?.map((category) => category.name) || []),
  ...(product.options?.flatMap((option) => [
    option.title,
    ...(option.values?.map((value) => value.value) || []),
  ]) || []),
  ...(product.variants?.flatMap((variant) => [
    variant.title,
    variant.sku,
    ...(variant.options?.map((option) => option.value) || []),
  ]) || []),
  ...flattenMetadata(product.metadata),
  ...extraTerms,
].filter((value): value is string => Boolean(value))

export const getProductSearchText = (
  product: HttpTypes.StoreProduct,
  extraTerms: string[] = []
) => normalizeProductSearchText(getProductSearchParts(product, extraTerms).join(" "))

export const productMatchesSearch = (
  product: HttpTypes.StoreProduct,
  query: string,
  extraTerms: string[] = []
) => {
  const terms = normalizeProductSearchText(query).split(" ").filter(Boolean)
  if (!terms.length) return true
  const haystack = getProductSearchText(product, extraTerms)
  return terms.every((term) => haystack.includes(term))
}

export const scoreProductSearch = (
  product: HttpTypes.StoreProduct,
  query: string,
  extraTerms: string[] = []
) => {
  if (!productMatchesSearch(product, query, extraTerms)) return -1
  const normalizedQuery = normalizeProductSearchText(query)
  const title = normalizeProductSearchText(product.title || "")
  if (title === normalizedQuery) return 100
  if (title.startsWith(normalizedQuery)) return 80
  if (title.includes(normalizedQuery)) return 60
  return 20
}
