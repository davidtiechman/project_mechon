export async function register() {
  if (
    process.env.PERF_DIAGNOSTICS_ENABLED !== "true" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  )
    return
  try {
    const { registerPerformanceContext } =
      await import("./lib/observability/register-context")
    registerPerformanceContext()
  } catch {
    // The application must boot even when optional diagnostics cannot initialize.
  }
}
