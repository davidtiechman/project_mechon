export async function contentApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/admin/site-content${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export async function uploadContentImage(file: File): Promise<string> {
  const form = new FormData()
  form.append("files", file)
  const response = await fetch("/admin/uploads", { method: "POST", credentials: "include", body: form })
  if (!response.ok) throw new Error("Upload failed")
  const data = await response.json()
  return data.files?.[0]?.url
}
