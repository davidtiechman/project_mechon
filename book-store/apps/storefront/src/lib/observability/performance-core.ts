// No request inputs or arbitrary attributes enter the diagnostic logger.
export const operations = [
  "nav.ready",
  "nav.jsx",
  "nav.initial_dependencies",
  "nav.regions",
  "nav.locales",
  "nav.locale",
  "nav.brands",
  "nav.catalog",
  "nav.year_cycle",
  "nav.brand_products_batch",
  "catalog.total",
  "catalog.fetch_to_headers",
  "catalog.read_json",
  "brand_products.total",
  "brand_products.tag",
  "brand_products.category",
  "brand_products.products",
  "medusa.locale_header",
  "medusa.products",
  "medusa.categories",
  "medusa.regions",
  "medusa.locales",
  "medusa.product_tags",
  "medusa.other",
] as const
export type Operation = (typeof operations)[number]

export type Settings = {
  enabled: boolean
  sampleRate: number
  maxTracesPerMinute: number
  maxEventsPerTrace: number
  maxBytesPerTrace: number
  maxLogsPerMinute: number
}

function numberSetting(
  value: string | undefined,
  fallback: number,
  max: number
) {
  if (value === undefined || value.trim() === "") return fallback
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : fallback
}

export function readSettings(
  env: Record<string, string | undefined>
): Settings {
  return {
    enabled: env.PERF_DIAGNOSTICS_ENABLED === "true",
    sampleRate: numberSetting(env.PERF_DIAGNOSTICS_SAMPLE_RATE, 0.01, 1),
    maxTracesPerMinute: Math.floor(
      numberSetting(env.PERF_DIAGNOSTICS_MAX_TRACES_PER_MINUTE, 10, 100)
    ),
    maxEventsPerTrace: Math.floor(
      numberSetting(env.PERF_DIAGNOSTICS_MAX_EVENTS_PER_TRACE, 100, 200)
    ),
    maxBytesPerTrace: Math.floor(
      numberSetting(env.PERF_DIAGNOSTICS_MAX_BYTES_PER_TRACE, 65536, 131072)
    ),
    maxLogsPerMinute: Math.floor(
      numberSetting(env.PERF_DIAGNOSTICS_MAX_LOGS_PER_MINUTE, 200, 1000)
    ),
  }
}

type Hooks = {
  now: () => number
  traceId: () => string | undefined
  random: () => number
  id: () => string
  emit: (line: string) => void
}
type State = {
  id: string
  start: number
  sampled: boolean
  events: number
  bytes: number
}

export function createDiagnostics(settings: Settings, hooks: Hooks) {
  const states = new Map<string, State>()
  const allowed = new Set<string>(operations)
  let windowStart = -Infinity
  let traces = 0
  let logs = 0
  let lastCleanup = -Infinity

  function begin(
    operation: Operation
  ): ((outcome: "ok" | "error") => void) | undefined {
    // The disabled path does not read context, clocks, randomness or log anything.
    if (!settings.enabled) return
    try {
      if (!allowed.has(operation)) return
      const traceId = hooks.traceId()
      if (!traceId) return // No shared fallback ID for requests without context.
      const now = hooks.now()
      if (now - windowStart >= 60000) {
        windowStart = now
        traces = 0
        logs = 0
      }
      if (now - lastCleanup >= 30000) {
        for (const [key, state] of states) {
          if (now - state.start >= 120000) states.delete(key)
        }
        lastCleanup = now
      }
      let state = states.get(traceId)
      if (!state) {
        if (states.size >= 2048) return
        const sampled =
          hooks.random() < settings.sampleRate &&
          traces < settings.maxTracesPerMinute
        state = {
          id: sampled ? hooks.id() : "",
          start: now,
          sampled,
          events: 0,
          bytes: 0,
        }
        states.set(traceId, state)
        if (sampled) traces++
      }
      if (!state.sampled || state.events >= settings.maxEventsPerTrace) return
      // Reserve an event at start so concurrent operations cannot exceed the cap.
      const event = ++state.events
      const current = state
      let finished = false
      return (outcome) => {
        if (finished) return
        finished = true
        try {
          const end = hooks.now()
          if (end - windowStart >= 60000) {
            windowStart = end
            traces = 0
            logs = 0
          }
          if (logs >= settings.maxLogsPerMinute) return
          const line = JSON.stringify({
            event: "perf_diagnostic",
            diagnostic_id: current.id,
            operation,
            invocation: event,
            start_offset_ms: Math.round((now - current.start) * 1000) / 1000,
            duration_ms: Math.round((end - now) * 1000) / 1000,
            outcome,
          })
          // Conservative UTF-16 byte accounting, safe even if a hook returns Unicode.
          const bytes = line.length * 2
          if (current.bytes + bytes > settings.maxBytesPerTrace) return
          current.bytes += bytes
          logs++
          hooks.emit(line)
        } catch {
          /* Telemetry must never change the application result. */
        }
      }
    } catch {
      return
    }
  }

  function measure<T>(
    operation: Operation,
    action: () => Promise<T>
  ): Promise<T> {
    const finish = begin(operation)
    if (!finish) return action()
    let pending: Promise<T>
    try {
      pending = action()
    } catch (error) {
      finish("error")
      throw error
    }
    return pending.then(
      (value) => {
        finish("ok")
        return value
      },
      (error: unknown) => {
        finish("error")
        throw error
      }
    )
  }
  function measureSync<T>(operation: Operation, action: () => T): T {
    const finish = begin(operation)
    if (!finish) return action()
    let outcome: "ok" | "error" = "ok"
    try {
      return action()
    } catch (error) {
      outcome = "error"
      throw error
    } finally {
      finish(outcome)
    }
  }
  return { measure, measureSync }
}

export function medusaOperation(input: unknown): Operation {
  // Only exact, known relative paths. Never log a URL, query or dynamic ID.
  if (typeof input !== "string") return "medusa.other"
  switch (input) {
    case "/store/products":
      return "medusa.products"
    case "/store/product-categories":
      return "medusa.categories"
    case "/store/regions":
      return "medusa.regions"
    case "/store/locales":
      return "medusa.locales"
    case "/store/product-tags":
      return "medusa.product_tags"
    default:
      return "medusa.other"
  }
}
