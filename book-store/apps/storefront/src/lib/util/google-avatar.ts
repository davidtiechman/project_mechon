/** Customer metadata key holding the Google profile picture shown in the header. */
export const GOOGLE_AVATAR_METADATA_KEY = "google_avatar_url"

/** Accept only Google-hosted profile pictures over https. */
export const safeGooglePicture = (value?: unknown) => {
  if (typeof value !== "string" || !value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com")
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Read the Google picture from the Medusa login token (JWT) without verifying it.
 * Used for display only: Medusa puts the provider's user_metadata in the token,
 * so customers who signed in with Google before the picture was saved still see it.
 */
export const googlePictureFromToken = (token?: string) => {
  const payload = token?.split(".")[1]
  if (!payload) return undefined
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return safeGooglePicture(decoded?.user_metadata?.picture)
  } catch {
    return undefined
  }
}
