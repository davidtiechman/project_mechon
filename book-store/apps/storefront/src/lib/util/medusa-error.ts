type MedusaError = {
  status?: number
  statusText?: string
  response?: {
    data: { message?: string } | string
    status: number
    headers: unknown
  }
  request?: unknown
  message?: string
  config?: { url: string; baseURL: string }
}

export default function medusaError(error: unknown): never {
  const err = error as MedusaError
  if (err.response) {
    const u = new URL(err.config?.url ?? "", err.config?.baseURL ?? "")
    console.error("Resource:", u.toString())
    console.error("Response data:", err.response.data)
    console.error("Status code:", err.response.status)
    console.error("Headers:", err.response.headers)

    const data = err.response.data
    const message =
      typeof data === "object" && data !== null
        ? data.message || String(data)
        : data

    throw new Error(message.charAt(0).toUpperCase() + message.slice(1) + ".")
  } else if (err.request) {
    throw new Error("No response received: " + String(err.request))
  } else if (typeof err.status === "number") {
    const detail = err.message || err.statusText || "Medusa request failed"
    throw new Error(`${detail} (HTTP ${err.status})`)
  } else {
    const detail =
      error instanceof Error ? error.message : String(error ?? "Unknown error")
    throw new Error("Error setting up the request: " + detail)
  }
}
