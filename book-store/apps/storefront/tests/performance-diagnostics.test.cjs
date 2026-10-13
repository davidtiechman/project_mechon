const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { setTimeout: delay } = require('node:timers/promises')
const { randomUUID } = require('node:crypto')
const { context, trace } = require('@opentelemetry/api')

function load(relative, dependencies = {}, globals = {}) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { fileName: relative, compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017,
  }}).outputText, { exports, require: name => name in dependencies ? dependencies[name] : require(name), ...globals })
  return exports
}
const core = load('lib/observability/performance-core.ts')
function setup(env = {}, overrides = {}) {
  let now = 0
  let request = 'request-a'
  const lines = []
  const hooks = { now: () => now, traceId: () => request, random: () => 0, id: randomUUID,
    emit: line => lines.push(JSON.parse(line)), ...overrides }
  const diagnostics = core.createDiagnostics(core.readSettings({ PERF_DIAGNOSTICS_ENABLED: 'true', PERF_DIAGNOSTICS_SAMPLE_RATE: '1', ...env }), hooks)
  return { ...diagnostics, lines, advance: n => { now += n }, request: id => { request = id } }
}

test('disabled diagnostics do not consult clock/context/randomness/ID/logger and preserve the original promise', async () => {
  const fail = () => { throw new Error('must not be called') }
  const s = setup({ PERF_DIAGNOSTICS_ENABLED: 'false' }, { now: fail, traceId: fail, random: fail, id: fail, emit: fail })
  const promise = Promise.resolve(42)
  assert.equal(s.measure('nav.ready', () => promise), promise)
  assert.equal(s.measureSync('nav.jsx', () => 42), 42)
  assert.equal(core.readSettings({}).enabled, false)
})

test('durations and start offsets use the monotonic clock, not wall time', async () => {
  const s = setup()
  await s.measure('nav.ready', async () => { s.advance(12.5); return 'result' })
  await s.measure('nav.catalog', async () => { s.advance(7); return null })
  assert.equal(s.lines[0].duration_ms, 12.5)
  assert.equal(s.lines[1].start_offset_ms, 12.5)
  assert.equal(s.lines[1].duration_ms, 7)
  assert.equal(s.lines[0].diagnostic_id, s.lines[1].diagnostic_id)
})

test('sync/async application failures retain identity and actions are never retried', async () => {
  const s = setup()
  const error = new Error('private customer payload')
  let count = 0
  await assert.rejects(s.measure('nav.ready', async () => { count++; throw error }), e => e === error)
  assert.throws(() => s.measure('nav.ready', () => { count++; throw error }), e => e === error)
  assert.throws(() => s.measureSync('nav.jsx', () => { count++; throw error }), e => e === error)
  assert.equal(count, 3)
  assert(s.lines.every(l => l.outcome === 'error'))
  assert(!JSON.stringify(s.lines).includes(error.message))
})

test('clock/context/ID/logger failures cannot fail or duplicate the application operation', async () => {
  for (const hook of ['now', 'traceId', 'random', 'id', 'emit']) {
    const s = setup({}, { [hook]: () => { throw new Error('telemetry unavailable') } })
    let count = 0
    assert.equal(await s.measure('nav.ready', async () => { count++; return 42 }), 42)
    assert.equal(count, 1)
  }
  const s = setup({}, { now: (() => { let calls = 0; return () => { if (calls++) throw new Error('clock failed at completion'); return 0 } })() })
  assert.equal(await s.measure('nav.ready', async () => 1), 1)
})

test('sampling is sticky for the entire trace, including unselected traces', async () => {
  let randomCalls = 0
  const s = setup({ PERF_DIAGNOSTICS_SAMPLE_RATE: '.5' }, { random: () => { randomCalls++; return .9 } })
  for (let i = 0; i < 5; i++) await s.measure('nav.ready', async () => 1)
  assert.equal(randomCalls, 1)
  assert.equal(s.lines.length, 0)
  s.request('request-b')
  await s.measure('nav.ready', async () => 1)
  assert.equal(randomCalls, 2)
})

test('event reservations cap concurrent operations; bytes/logs/new traces are bounded', async () => {
  const capped = setup({ PERF_DIAGNOSTICS_MAX_EVENTS_PER_TRACE: '2' })
  await Promise.all(Array.from({ length: 20 }, () => capped.measure('nav.ready', async () => 1)))
  assert.equal(capped.lines.length, 2)
  const bytes = setup({ PERF_DIAGNOSTICS_MAX_BYTES_PER_TRACE: '1' })
  await bytes.measure('nav.ready', async () => 1)
  assert.equal(bytes.lines.length, 0)
  const limited = setup({ PERF_DIAGNOSTICS_MAX_TRACES_PER_MINUTE: '1' })
  await limited.measure('nav.ready', async () => 1)
  limited.request('request-b'); await limited.measure('nav.ready', async () => 1)
  assert.equal(limited.lines.length, 1)
  limited.advance(60001); limited.request('request-c'); await limited.measure('nav.ready', async () => 1)
  assert.equal(limited.lines.length, 2)
  const logs = setup({ PERF_DIAGNOSTICS_MAX_LOGS_PER_MINUTE: '1' })
  await logs.measure('nav.ready', async () => 1); await logs.measure('nav.catalog', async () => 1)
  assert.equal(logs.lines.length, 1)
})

test('context-free work and arbitrary operation names emit nothing; endpoints are allowlisted', async () => {
  const s = setup({}, { traceId: () => undefined })
  await s.measure('nav.ready', async () => 1)
  assert.equal(s.lines.length, 0)
  const privateName = setup()
  await privateName.measure('https://example.com/customer?token=secret', async () => 1)
  assert.equal(privateName.lines.length, 0)
  assert.equal(core.medusaOperation('/store/products'), 'medusa.products')
  for (const value of ['https://example.com/store/products?token=secret', '/store/carts/private-id', '/store/products?email=secret', new URL('https://example.com')]) {
    assert.equal(core.medusaOperation(value), 'medusa.other')
  }
})

test('real Next request tracing isolates concurrent requests and retains delayed sibling context', async () => {
  // Same non-recording provider as production: valid context, no exported spans.
  const registration = load('lib/observability/register-context.ts', { 'server-only': {}, './performance-core': core }, { process: { env: {} } })
  registration.registerPerformanceContext()
  const delegate = trace.getTracerProvider().getDelegate()
  registration.registerPerformanceContext()
  assert.equal(trace.getTracerProvider().getDelegate(), delegate, 'reuse provider on subsequent initialization')
  const { getTracer } = require('next/dist/server/lib/trace/tracer')
  const lines = []
  const d = core.createDiagnostics(core.readSettings({ PERF_DIAGNOSTICS_ENABLED: 'true', PERF_DIAGNOSTICS_SAMPLE_RATE: '1' }), {
    now: () => performance.now(), random: () => 0, id: randomUUID,
    traceId: () => trace.getSpan(context.active())?.spanContext().traceId,
    emit: line => lines.push(JSON.parse(line)),
  })
  const request = (gap) => getTracer().trace('BaseServer.handleRequest', async () => {
    const root = trace.getSpan(context.active()).spanContext().traceId
    await Promise.all([
      d.measure('nav.ready', async () => { await delay(gap) }),
      d.measure('catalog.total', async () => { await delay(gap + 2) }),
    ])
    await delay(2)
    await d.measure('medusa.products', async () => assert.equal(trace.getSpan(context.active()).spanContext().traceId, root))
    return root
  })
  const roots = await Promise.all([request(6), request(1)])
  assert.notEqual(roots[0], roots[1])
  const ids = [...new Set(lines.map(l => l.diagnostic_id))]
  assert.equal(ids.length, 2)
  for (const id of ids) assert.equal(lines.filter(l => l.diagnostic_id === id).length, 3)
  assert.equal(trace.getSpan(context.active()), undefined)
  // Existing tracer IDs are never written to logs.
  for (const root of roots) assert(!JSON.stringify(lines).includes(root))
})

test('settings clamp invalid or excessive values; context storage remains bounded', async () => {
  const settings = core.readSettings({ PERF_DIAGNOSTICS_SAMPLE_RATE: 'NaN', PERF_DIAGNOSTICS_MAX_LOGS_PER_MINUTE: '999999', PERF_DIAGNOSTICS_MAX_EVENTS_PER_TRACE: '-3' })
  assert.equal(settings.sampleRate, .01)
  assert.equal(settings.maxLogsPerMinute, 1000)
  assert.equal(settings.maxEventsPerTrace, 0)
  let calls = 0
  const s = setup({ PERF_DIAGNOSTICS_SAMPLE_RATE: '0' }, { random: () => { calls++; return 1 } })
  for (let i = 0; i < 3000; i++) { s.request(String(i)); await s.measure('nav.ready', async () => 1) }
  assert.equal(calls, 2048)
  s.advance(150000); s.request('after-expiry'); await s.measure('nav.ready', async () => 1)
  assert.equal(calls, 2049)
})

test('bootstrap is a no-op when disabled or on Edge, and initialization failure does not prevent boot', async () => {
  let calls = 0
  const dependency = { registerPerformanceContext: () => { calls++; throw new Error('optional diagnostics failed') } }
  for (const env of [{}, { PERF_DIAGNOSTICS_ENABLED: 'false', NEXT_RUNTIME: 'nodejs' }, { PERF_DIAGNOSTICS_ENABLED: 'true', NEXT_RUNTIME: 'edge' }]) {
    await load('instrumentation.ts', { './lib/observability/register-context': dependency }, { process: { env } }).register()
  }
  assert.equal(calls, 0)
  await load('instrumentation.ts', { './lib/observability/register-context': dependency }, {
    process: { env: { PERF_DIAGNOSTICS_ENABLED: 'true', NEXT_RUNTIME: 'nodejs' } },
  }).register()
  assert.equal(calls, 1)
})

test('browser helper ignores private environment variables and does not consult OTel', async () => {
  const fail = () => { throw new Error('should not run') }
  const helper = load('lib/observability/performance.ts', {
    './performance-core': core,
    '@opentelemetry/api': { context: { active: fail }, trace: { getSpan: fail }, isSpanContextValid: fail },
  }, { window: {}, process: { get env() { throw new Error('private env must not be read') } } })
  const promise = Promise.resolve('ok')
  assert.equal(helper.measurePerformance('nav.ready', () => promise), promise)
  assert.equal(await promise, 'ok')
})

test('deferred work retains request identity even after the parent Next span has ended', async () => {
  const { getTracer } = require('next/dist/server/lib/trace/tracer')
  const lines = []
  const d = core.createDiagnostics(core.readSettings({ PERF_DIAGNOSTICS_ENABLED: 'true', PERF_DIAGNOSTICS_SAMPLE_RATE: '1' }), {
    now: () => performance.now(), random: () => 0, id: randomUUID,
    traceId: () => trace.getSpan(context.active())?.spanContext().traceId,
    emit: line => lines.push(JSON.parse(line)),
  })
  const deferredWork = []
  await Promise.all([1, 2].map(() => getTracer().trace('BaseServer.handleRequest', async () => {
    await d.measure('nav.ready', async () => 1)
    deferredWork.push(delay(10).then(() => d.measure('medusa.products', async () => 1)))
  })))
  assert.equal(lines.length, 2)
  await Promise.all(deferredWork)
  const ids = new Set(lines.map(l => l.diagnostic_id))
  assert.equal(ids.size, 2)
  for (const id of ids) assert.deepEqual(lines.filter(l => l.diagnostic_id === id).map(l => l.operation), ['nav.ready', 'medusa.products'])
})

test('enabled Node bootstrap connects the production helper to request-local diagnostics', async () => {
  const lines = []
  const shared = { crypto: { randomUUID } }
  const registration = load('lib/observability/register-context.ts', { 'server-only': {}, './performance-core': core }, {
    globalThis: shared, performance, console: { info: line => lines.push(JSON.parse(line)) },
    process: { env: { PERF_DIAGNOSTICS_ENABLED: 'true', PERF_DIAGNOSTICS_SAMPLE_RATE: '1' } },
  })
  registration.registerPerformanceContext()
  const helper = load('lib/observability/performance.ts', { './performance-core': core }, { globalThis: shared })
  const { getTracer } = require('next/dist/server/lib/trace/tracer')
  await Promise.all([1, 2].map(() => getTracer().trace('BaseServer.handleRequest', async () => {
    assert.equal(helper.measureSynchronous('nav.jsx', () => 42), 42)
    assert.equal(await helper.measurePerformance('nav.ready', async () => { await delay(1); return 'ready' }), 'ready')
  })))
  assert.equal(lines.length, 4)
  const ids = new Set(lines.map(line => line.diagnostic_id))
  assert.equal(ids.size, 2)
  for (const id of ids) assert.equal(lines.filter(line => line.diagnostic_id === id).length, 2)
})
