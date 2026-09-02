export const safeReturnPath = (
  value: string | null | undefined,
  fallback = "/il/account"
) =>
  value?.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  value.length <= 2048
    ? value
    : fallback

