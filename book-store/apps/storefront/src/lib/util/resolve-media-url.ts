const LOCAL_MEDIA_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

/**
 * Medusa stores uploaded file URLs as absolute URLs. If a product was created
 * while Medusa was running locally, that URL can still point at localhost.
 * Replace only that local origin with the configured public backend origin.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined
  }

  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL

  if (!backendUrl) {
    return url
  }

  try {
    const mediaUrl = new URL(url)

    if (!LOCAL_MEDIA_HOSTS.has(mediaUrl.hostname)) {
      return url
    }

    const backend = new URL(backendUrl)
    return new URL(
      `${mediaUrl.pathname}${mediaUrl.search}${mediaUrl.hash}`,
      backend
    ).toString()
  } catch {
    return url
  }
}
