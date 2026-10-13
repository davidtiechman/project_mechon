const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(relative, dependencies, globals = {}) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8')
  const code = ts.transpileModule(source, { fileName: relative, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText
  vm.runInNewContext(code, { exports, require: name => {
    if (name in dependencies) return dependencies[name]
    if (name === 'react' || name === 'react/jsx-runtime') return require(name)
    if (name.startsWith('@modules/') || name === 'next/image') return { default: name, HeaderProductSearch: name }
    throw new Error('Unexpected dependency: ' + name)
  }, ...globals })
  return exports
}
function measurements() {
  const events = []
  return { events,
    measurePerformance: (name, action) => {
      events.push(['start', name])
      return action().then(value => { events.push(['end', name]); return value }, error => { events.push(['error', name]); throw error })
    },
    measureSynchronous: (name, action) => { events.push(['start', name]); const value = action(); events.push(['end', name]); return value },
  }
}
function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

test('Nav starts the same six dependencies together, then starts all brand lookups together; JSX boundaries remain intact', async () => {
  const calls = []
  const m = measurements()
  const first = Array.from({ length: 6 }, deferred)
  const brands = [deferred(), deferred()]
  const begin = (name, index) => () => { calls.push(name); return first[index].promise }
  const nav = load('modules/layout/templates/nav/index.tsx', {
    '@lib/observability/performance': m,
    '@lib/data/regions': { listRegions: begin('regions', 0) },
    '@lib/data/locales': { listLocales: begin('locales', 1) },
    '@lib/data/locale-actions': { getLocale: begin('locale', 2) },
    '@lib/data/site-content': { listContent: begin('brands', 3), getActiveCatalog: begin('catalog', 4) },
    '@lib/data/categories': { getYearCycleMenu: begin('yearCycle', 5) },
    '@lib/data/brand-products': { getBrandProducts: item => { calls.push('brand-' + item.slug); return brands[item.slug === 'one' ? 0 : 1].promise } },
    '@lib/util/resolve-media-url': { resolveMediaUrl: x => x },
    '@lib/data/institute-projects': { instituteProjects: [] },
  }).default
  const pending = nav({ countryCode: 'il' })
  assert.deepEqual(calls, ['regions', 'locales', 'locale', 'brands', 'catalog', 'yearCycle'])
  first[0].resolve([]); first[1].resolve([]); first[2].resolve(null)
  first[3].resolve([{ slug: 'one' }, { slug: 'two' }]); first[4].resolve(null)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.length, 6, 'all six dependencies must resolve before the next group')
  first[5].resolve(null)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls.slice(6), ['brand-one', 'brand-two'])
  brands[0].resolve([]); brands[1].resolve([])
  const tree = await pending
  const encoded = JSON.stringify(tree, (_key, value) => typeof value === 'symbol' ? String(value) : value)
  assert(encoded.includes('nav-cart-link'))
  assert(encoded.includes('react.suspense'))
  assert(m.events.some(e => e[1] === 'nav.jsx'))
  assert.equal(m.events.at(-1)[1], 'nav.ready')
})

test('central SDK timing preserves input, method, headers, cache and result; SDK failures preserve identity', async () => {
  const m = measurements()
  const calls = []
  const result = { products: [] }
  let failure
  class Medusa {
    client = { fetch: async (...args) => { calls.push(args); if (failure) throw failure; return result } }
  }
  const coreSource = fs.readFileSync(path.join(__dirname, '../src/lib/observability/performance-core.ts'), 'utf8')
  const core = {}
  vm.runInNewContext(ts.transpileModule(coreSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: core })
  const sdk = load('lib/config.ts', {
    '@lib/observability/performance': { ...m, medusaOperation: core.medusaOperation },
    '@lib/util/get-locale-header': { getLocaleHeader: async () => ({ 'x-medusa-locale': 'he' }) },
    '@medusajs/js-sdk': { default: Medusa },
  }, { process: { env: {} } }).sdk
  const init = { method: 'GET', headers: { authorization: 'private-token' }, cache: 'force-cache', next: { revalidate: 60 } }
  assert.equal(await sdk.client.fetch('/store/products', init), result)
  assert.equal(calls[0][0], '/store/products')
  assert.equal(calls[0][1].cache, 'force-cache')
  assert.equal(calls[0][1].next, init.next)
  assert.equal(calls[0][1].method, 'GET')
  assert.deepEqual(Object.keys(calls[0][1].headers).sort(), ['authorization', 'x-medusa-locale'])
  assert.equal(calls[0][1].headers.authorization, 'private-token')
  assert.deepEqual(m.events.map(x => x[1]), ['medusa.locale_header', 'medusa.locale_header', 'medusa.products', 'medusa.products'])
  assert(!JSON.stringify(m.events).includes('private-token'))
  failure = new Error('upstream failed')
  await assert.rejects(sdk.client.fetch('/store/products', init), e => e === failure)
  assert.equal(calls.length, 2)
})

test('catalog records fetch and body separately and retains no-store, non-OK and error behavior', async () => {
  for (const mode of ['success', 'non-ok', 'network-error', 'json-error']) {
    const m = measurements()
    const catalog = { file_name: 'catalog.pdf', file_url: 'private-url-not-for-logs' }
    const args = []
    const get = load('lib/data/site-content.ts', { 'server-only': {}, '@lib/observability/performance': m }, {
      process: { env: {} }, fetch: async (...a) => {
        args.push(a)
        if (mode === 'network-error') throw new Error('private network detail')
        return { ok: mode !== 'non-ok', json: async () => {
          if (mode === 'json-error') throw new Error('private JSON detail')
          return { catalog }
        } }
      },
    }).getActiveCatalog
    assert.equal(await get(), mode === 'success' ? catalog : null)
    assert.equal(args.length, 1)
    assert.equal(args[0][1].cache, 'no-store')
    assert.deepEqual(Object.keys(args[0][1].headers || {}), [])
    const started = m.events.filter(x => x[0] === 'start').map(x => x[1])
    assert.deepEqual(started, mode === 'non-ok' || mode === 'network-error'
      ? ['catalog.total', 'catalog.fetch_to_headers']
      : ['catalog.total', 'catalog.fetch_to_headers', 'catalog.read_json'])
    assert(!JSON.stringify(m.events).includes('private'))
  }
})
