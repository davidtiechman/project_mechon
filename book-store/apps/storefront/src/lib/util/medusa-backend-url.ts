export function getMedusaBackendUrl() {
  const internalUrl =
    typeof window === "undefined" ? process.env.MEDUSA_BACKEND_URL : undefined

  return internalUrl || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
}
