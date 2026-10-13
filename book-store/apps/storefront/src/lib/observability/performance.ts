import type { Operation } from "./performance-core"

type Diagnostics = {
  measure: <T>(operation: Operation, action: () => Promise<T>) => Promise<T>
  measureSync: <T>(operation: Operation, action: () => T) => T
}
const key = Symbol.for("maaseh.performance.diagnostics")

function diagnostics(): Diagnostics | undefined {
  // The SDK wrapper is also imported by client components. Keep all OTel,
  // environment reads and logging machinery in the Node instrumentation entry.
  if (typeof window !== "undefined") return
  return (globalThis as unknown as Record<symbol, Diagnostics | undefined>)[key]
}

export function measurePerformance<T>(
  operation: Operation,
  action: () => Promise<T>
): Promise<T> {
  const active = diagnostics()
  return active ? active.measure(operation, action) : action()
}

export function measureSynchronous<T>(
  operation: Operation,
  action: () => T
): T {
  const active = diagnostics()
  return active ? active.measureSync(operation, action) : action()
}

export { medusaOperation } from "./performance-core"
