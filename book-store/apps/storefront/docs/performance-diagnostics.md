# Focused server performance diagnostics

Diagnostics are **off by default**. This change does not enable them in Railway, deploy the site or run production requests. It does not alter fetch headers, cache policies, Promise.all ordering, Suspense boundaries or HTML output. It adds no external telemetry destination.

## Existing tracing and request identity

The storefront had no instrumentation entry point or initialized OTel provider. OTel API 1.9.1 and Node trace SDK 2.9.0 were already in the monorepo lockfile (via backend dependencies); the storefront now declares those same versions explicitly. No new versions or collector dependencies were introduced.

`src/instrumentation.ts` initializes context only when `PERF_DIAGNOSTICS_ENABLED=true` and `NEXT_RUNTIME=nodejs`. If a valid existing provider is detected it is reused. Otherwise a NodeTracerProvider supplies async request context for Next's built-in request spans, using non-recording spans, no exporters and no injected propagator. No HTTP auto-instrumentation or new Medusa headers are installed. Existing provider/exporter behavior remains the responsibility of its existing configuration.

Measurements group by the active OTel trace and use a fresh random UUID (`diagnostic_id`) in the emitted records. Incoming trace/request IDs are not logged, and cannot force sampling. Missing valid context means **skip diagnostics**, not a shared global fallback. This is a trace-level correlation unit: if an existing provider groups multiple HTTP requests into one distributed trace, they can share a diagnostic ID; the default context-only provider does not extract incoming trace headers and gives each Next request its own trace. Verify the host's existing provider configuration before using it for request-level attribution.

No new `headers()`/`cookies()` reads are introduced for instrumentation. There is no request context stored around only PageLayout: Next's request context spans deferred React work. React component completion is not stream/socket completion.

## Operation meanings

| Operation | Meaning |
|---|---|
| `nav.ready` | Inclusive elapsed time until Nav returns JSX; not time until all descendants render or bytes reach the client |
| `nav.jsx` | Synchronous JSX construction by Nav; excludes dependency waits and deferred child rendering |
| `nav.initial_dependencies` | First unchanged Promise.all: regions, locales, current locale, brands, active catalog, year-cycle menu |
| `nav.regions/locales/locale/brands/catalog/year_cycle` | Individual first-phase dependencies |
| `nav.brand_products_batch` | Second unchanged Promise.all across all brand lookups |
| `brand_products.total` | One invocation, including conditional filter lookup and product retrieval |
| `brand_products.tag/category/products` | Conditional lookup and products phases; no brand identity is logged |
| `catalog.total` | Entire active catalog operation; original null/error handling retained |
| `catalog.fetch_to_headers` | fetch resolution to response headers (can be cache/platform mediated) |
| `catalog.read_json` | Reading the remaining response body and parsing JSON |
| `medusa.locale_header` | SDK wrapper's existing locale lookup, separate from the SDK call |
| `medusa.products/categories/regions/locales/product_tags/other` | `originalFetch` resolution, including SDK preparation, cached or physical fetch, body consumption and JSON parsing |

SDK duration is **not pure network latency or TTFB**. It cannot prove a physical Medusa request occurred, identify a Next cache hit, or separate DNS/TCP/TLS/body/JSON parsing. A total enclosing child operations overlaps their time; do not add parent and child durations. `nav.ready` is not CPU time. `start_offset_ms` starts at the first measured operation in the trace, not necessarily at HTTP arrival.

No product, customer, brand or cart IDs, URLs, query strings, search terms, cookies, tokens, headers, bodies, arguments or raw exception text are emitted. Endpoint names come from an exact fixed allowlist; every other input is `medusa.other`. This applies to diagnostics only, not to any pre-existing application/hosting logs. Records contain fixed event/operation names, opaque diagnostic ID, invocation number, offsets, duration and `ok/error`. Railway supplies wall-clock log timestamps; performance.now() supplies monotonic durations. A caught catalog failure can appear as an inner error and an outer success because the original function returns null; that behavior is retained.

## Railway activation (manual, requires separate approval)

1. After the code has been reviewed, tested and separately approved for deployment, deploy the normal storefront artifact.
2. In the **storefront service** Railway Variables, set:

```text
PERF_DIAGNOSTICS_ENABLED=true
PERF_DIAGNOSTICS_SAMPLE_RATE=0.01
PERF_DIAGNOSTICS_MAX_TRACES_PER_MINUTE=10
PERF_DIAGNOSTICS_MAX_EVENTS_PER_TRACE=100
PERF_DIAGNOSTICS_MAX_BYTES_PER_TRACE=65536
PERF_DIAGNOSTICS_MAX_LOGS_PER_MINUTE=200
```

3. Apply through Railway's normal restart/redeploy flow. Environment values are read at instrumentation initialization; changing variables is not a live switch for existing processes. These variables must never use `NEXT_PUBLIC_`.
4. Inspect existing deployment stdout logs for `perf_diagnostic`; group by `diagnostic_id` and sort by `start_offset_ms`, not log arrival (completion order).
5. For a separately approved short one-user diagnostic window, sample rate can temporarily be `1`, keeping all other caps. Missing logs can indicate sampling, caps, missing context or a static/CDN-served response; absence does not prove fast execution.
6. Disable by setting `PERF_DIAGNOSTICS_ENABLED=false` (or removing it) and restarting/redeploying the service. No Railway changes are performed automatically by this implementation.

## Overhead and bounds

Disabled measurements directly invoke the original callback: no diagnostic clocks, context lookup, random UUID generation or logging, and async measurements return the original Promise. The server provider is not initialized while disabled; the lightweight helper still has a small import cost; OTel and the logger are initialized only in the Node entry point. Browser diagnostics are always disabled. When enabled, sampling is sticky at trace level, including unsampled traces. Completed operations emit one small JSON line only for selected traces, under all caps.

All limits are **per process**; replicas multiply totals. Hard configuration ceilings: 100 selected traces/min, 200 events/trace, 128 KiB accounted bytes/trace, 1,000 log lines/min. Defaults are lower. UTF-16 accounting conservatively overestimates these ASCII records. Invocation slots are reserved before asynchronous work, so concurrent operations cannot bypass the event cap. The context table is capped at 2,048 entries, lazily pruned with a 120-second TTL; diagnostics have no long-lived per-request timers. Very long traces can lose correlation after expiry. The minute limiter is a fixed window, not a strict rolling-window rate bound. Dropped events are expected and timelines can be incomplete.

There is no exporter network I/O, file output, awaited log flush or response buffering. Logging goes to existing stdout and still has bounded nonzero overhead; a slow stdout sink can affect performance. Logger/context/clock failures are swallowed without changing application returns/errors or retrying an action. Failure to initialize diagnostics does not prevent server boot.

## Validation

```sh
# From book-store:
node --test apps/storefront/tests/performance-diagnostics.test.cjs apps/storefront/tests/performance-integration.test.cjs apps/storefront/tests/brand-products.test.cjs
npx tsc --noEmit --incremental false -p apps/storefront/tsconfig.json
npm run lint --workspace=@dtc/storefront
```

Tests exercise real Next request tracing with concurrent requests and deferred siblings, disabled fast path, sticky sampling, log/event/byte/memory limits, exceptions, absence of private data, original SDK headers/cache/results, unchanged Nav dependency ordering, and catalog fetch/body timing. Build checks validate server/client import compatibility. No production load test is required or authorized by these checks.

Validation on 2026-10-13: 20 focused tests passed; TypeScript (`--noEmit --incremental false`) passed; storefront lint (`--max-warnings=0`) passed; production build passed (35 static pages generated), and `git diff --check` passed. The sandbox build initially reported EPERM on data fetches; the final network-enabled build completed without fetch errors. npm still reports the existing workspace `auto-install-peers` configuration warning. Diagnostics remained disabled in all real environment variables; enabled behavior was exercised only in isolated tests.
