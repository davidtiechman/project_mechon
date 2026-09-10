const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    exports, process: { env: {} }, TextEncoder, AbortSignal,
    require(name) {
      if (name in dependencies) return dependencies[name]
      if (['react/jsx-runtime', 'zod', 'libphonenumber-js'].includes(name)) return require(name)
      throw new Error(`Unexpected import: ${name}`)
    },
    ...globals,
  })
  return exports
}
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}

test('published articles retain bracketed citations and completion wording; explicit drafts stay hidden', () => {
  const render = load('modules/content/templates/content-page.tsx', {
    'next/image': { default: 'Image' },
    '@modules/products/components/product-preview': { default: 'ProductPreview' },
  }).default
  const content = '<p>[ברכות ב.] להשלמה עיין במקורות.</p>'
  const published = nodes(render({ item: { status: 'published', content } }))
  assert.equal(published.find(node => node.type === 'article').props.dangerouslySetInnerHTML.__html, content)
  assert.equal(published.some(node => node.props?.role === 'status'), false)
  const draft = nodes(render({ item: { status: 'draft', content } }))
  assert.equal(draft.some(node => node.type === 'article'), false)
  assert.equal(draft.some(node => node.props?.role === 'status'), true)
})

test('cart cookie supports external GET returns while retaining production protections', async () => {
  const calls = []
  const cookies = load('lib/data/cookies.ts', {
    'server-only': {}, 'next/headers': { cookies: async () => ({ set: (...args) => calls.push(args) }) },
  }, { process: { env: { NODE_ENV: 'production' } } })
  await cookies.setCartId('cart_test')
  assert.equal(calls[0][0], '_medusa_cart_id')
  assert.equal(calls[0][2].sameSite, 'lax')
  assert.equal(calls[0][2].httpOnly, true)
  assert.equal(calls[0][2].secure, true)
})

test('editing a city preserves the street until a different city is confirmed', () => {
  const slots = []
  let cursor = 0, effects = [], dirty = false
  const hooks = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true }
      }]
    },
    useRef(value) { const index = cursor++; return slots[index] ||= { current: value } },
    useMemo(fn, deps) {
      const index = cursor++
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { deps, value: fn() }
      return slots[index].value
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      const index = cursor++
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index][i]))) { slots[index] = deps; effects.push(fn) }
    },
  }
  const component = load('modules/checkout/components/shipping-address/index.tsx', {
    react: hooks,
    '@modules/common/components/checkbox': { default: 'Checkbox' },
    '@modules/common/components/ui': { Container: 'Container' },
    '@modules/common/components/input': { default: 'Input' },
    lodash: { mapKeys: () => ({}) },
    '../address-select': { default: 'AddressSelect' },
    '../country-select': { default: 'CountrySelect' },
    '@lib/util/checkout-validation': load('lib/util/checkout-validation.ts'),
  }, { AbortController, window: { setTimeout: () => 1, clearTimeout() {} }, fetch: () => new Promise(() => {}) }).default
  const props = { customer: null, checked: true, onChange() {}, cart: { shipping_address: { city: 'ירושלים', address_1: 'דובר שלום 7', country_code: 'il' }, region: { countries: [{ iso_2: 'il' }] } } }
  function render() {
    let tree
    for (let i = 0; i < 20; i++) {
      cursor = 0; effects = []; dirty = false
      tree = component(props)
      effects.forEach(effect => effect())
      if (!dirty) return nodes(tree)
    }
    throw new Error('Render did not settle')
  }
  let tree = render()
  function edit(value) {
    tree.find(node => node.props?.name === 'shipping_address.city').props.onChange({ target: { value } })
    tree = render()
  }
  const street = () => tree.find(node => node.props?.name === 'shipping_address.street').props.value
  edit('ירושלי')
  assert.equal(street(), 'דובר שלום')
  slots[1] = [{ name: 'ירושלים', code: 3000 }, { name: 'חיפה', code: 4000 }]
  edit('ירושלים')
  assert.equal(street(), 'דובר שלום')
  edit('חיפה')
  assert.equal(street(), '')
})

test('partial contact configuration falls back to backend; complete direct delivery is never retried', async () => {
  const validation = load('lib/util/checkout-validation.ts')
  async function send(env, ok = true) {
    const calls = []
    const route = load('app/api/contact/route.ts', {
      '@lib/util/checkout-validation': validation,
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    }, {
      process: { env: { NEXT_PUBLIC_MEDUSA_BACKEND_URL: 'https://backend.example', ...env } },
      fetch: async (url) => { calls.push(url); return { ok, json: async () => ({ id: 'test-receipt' }) } },
    })
    const response = await route.POST({ text: async () => JSON.stringify({ name: 'Test User', email: 'test@example.com', phone: '0501234567', inquiry: 'Regression test only' }) })
    return { response, calls }
  }
  for (const env of [{}, { RESEND_API_KEY: 'test' }, { CONTACT_FORM_TO_EMAIL: 'contact@example.com' }]) {
    const result = await send(env)
    assert.equal(result.response.status, 200)
    assert.deepEqual(result.calls, ['https://backend.example/store/contact'])
  }
  const direct = { RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'from@example.com', CONTACT_FORM_TO_EMAIL: 'to@example.com' }
  assert.deepEqual((await send(direct)).calls, ['https://api.resend.com/emails'])
  const failure = await send(direct, false)
  assert.equal(failure.response.status, 502)
  assert.equal(failure.calls.length, 1)
  const invalid = await send({ ...direct, CONTACT_FORM_TO_EMAIL: 'invalid' })
  assert.equal(invalid.response.status, 503)
  assert.equal(invalid.calls.length, 0)
})
