import "server-only"
import { context, isSpanContextValid, trace } from "@opentelemetry/api"
import {
  NodeTracerProvider,
  SamplingDecision,
} from "@opentelemetry/sdk-trace-node"
import { createDiagnostics, readSettings } from "./performance-core"

export function registerPerformanceContext() {
  const key = Symbol.for("maaseh.performance.diagnostics")
  const registry = globalThis as unknown as Record<
    symbol,
    ReturnType<typeof createDiagnostics> | undefined
  >
  if (registry[key]) return

  // Reuse an existing provider if one was installed by the hosting environment.
  const probe = trace
    .getTracer("maaseh-performance")
    .startSpan("perf.context_probe")
  const existing = isSpanContextValid(probe.spanContext())
  probe.end()
  if (!existing) {
    // Next's built-in request spans provide async context even when not recorded.
    // No exporter, auto HTTP instrumentation or propagation headers are installed.
    const provider = new NodeTracerProvider({
      sampler: {
        shouldSample: () => ({ decision: SamplingDecision.NOT_RECORD }),
      },
      spanProcessors: [],
    })
    provider.register({ propagator: null })
  }

  registry[key] = createDiagnostics(readSettings(process.env), {
    now: () => performance.now(),
    random: () => Math.random(),
    id: () => globalThis.crypto.randomUUID(),
    traceId: () => {
      const span = trace.getSpan(context.active())?.spanContext()
      return span && isSpanContextValid(span) ? span.traceId : undefined
    },
    emit: (line) => console.info(line),
  })
}
