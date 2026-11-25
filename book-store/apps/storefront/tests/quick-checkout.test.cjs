const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, FormData, Error, URLSearchParams, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return require(name)
    if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name)
    return dependencies[name]
  } })
  return exports
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
function hooks() {
  let index = 0
  const values = []
  return {
    react: {
      useState(initial) { const key = index++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial; return [values[key], value => { values[key] = typeof value === 'function' ? value(values[key]) : value }] },
      useRef(initial) { const key = index++; return values[key] ||= { current: initial } },
      useEffect() {}, useMemo: fn => fn(), useTransition: () => [false, fn => fn()],
    },
    render(Component, props) { index = 0; return Component(props) },
  }
}

const provider = 'pp_nedarim_nedarim'
const payment = { status: 'pending', payment: { TransactionId: '900', Key: 'test-key', Methods: 'Card,Bit', ButtonText: 'תשלום' } }
function preparation({ sessions = [], total = 123.45, alreadyPaid = false, addressError, marketingError = false, begins = [] } = {}) {
  const events = [], initiated = [], beginArgs = []
  const cart = { id: 'cart_owned', total, currency_code: 'ils', payment_collection: { payment_sessions: sessions } }
  const { prepareQuickCheckout } = load('lib/data/quick-checkout.ts', {
    '@lib/config': { sdk: { client: { fetch: async (url, options) => { assert.equal(url, '/store/carts/cart_owned'); assert.equal(options.cache, 'no-store'); events.push('read'); return { cart } } } } },
    '@lib/checkout-consent': { CHECKOUT_TERMS_VERSION: 'terms-v1', CHECKOUT_CONSENT_ERROR: 'consent required' },
    '@lib/marketing-consent': { MARKETING_CONSENT_VERSION: 'marketing-v1' },
    './cookies': { getCartId: async () => 'cart_owned', getAuthHeaders: async () => ({}) },
    './cart': {
      saveCheckoutAddresses: async () => { events.push('address'); return addressError || null },
      setShippingMethod: async value => { assert.equal(value.cartId, 'cart_owned'); assert.equal(value.shippingMethodId, 'so_chosen'); events.push('shipping') },
      initiatePaymentSession: async (cart, data) => { events.push('session'); initiated.push({ total: cart.total, provider: data.provider_id }) },
    },
    './checkout-consent': { acceptCheckoutTerms: async (accepted, version) => { assert.equal(accepted, true); assert.equal(version, 'terms-v1'); events.push('terms') } },
    './marketing-consent': { saveCheckoutMarketingConsent: async (accepted, version) => { assert.equal(version, 'marketing-v1'); events.push('marketing:' + accepted); if (marketingError) throw new Error('unavailable') } },
    './nedarim': {
      getNedarimPaymentStatus: async () => { events.push('status'); return { status: alreadyPaid ? 'paid' : 'pending' } },
      beginNedarimPayment: async (...args) => { events.push('begin'); beginArgs.push(args); return begins.length ? begins.shift() : payment },
    },
  })
  const data = new FormData()
  data.set('shipping_option_id', 'so_chosen')
  data.set('amount', '1')
  data.set('cart_id', 'cart_someone_else')
  return { events, initiated, beginArgs, data, run: (accepted = true, marketing = false) => prepareQuickCheckout(data, accepted, marketing) }
}

test('one checkout action saves details, selects shipping and persists consent before opening the server-priced payment', async () => {
  const flow = preparation()
  assert.equal((await flow.run()).payment.Key, 'test-key')
  assert.deepEqual(flow.events, ['read', 'address', 'shipping', 'read', 'session', 'terms', 'marketing:false', 'begin'])
  assert.deepEqual(flow.initiated, [{ total: 123.45, provider }])
})
test('unchecked terms, missing shipping and invalid addresses cannot open a payment', async () => {
  const unchecked = preparation()
  await assert.rejects(unchecked.run(false), /consent required/)
  assert.deepEqual(unchecked.events, [])
  const noShipping = preparation()
  noShipping.data.delete('shipping_option_id')
  await assert.rejects(noShipping.run(), /משלוח/)
  assert.deepEqual(noShipping.events, [])
  const invalid = preparation({ addressError: 'invalid address' })
  await assert.rejects(invalid.run(), /invalid address/)
  assert.deepEqual(invalid.events, ['read', 'address'])
})
test('a matching pending session is reused; a changed server total requires a new session', async () => {
  const session = { provider_id: provider, status: 'pending', amount: 123.45, currency_code: 'ils' }
  const same = preparation({ sessions: [session] })
  await same.run()
  assert.equal(same.initiated.length, 0)
  assert.equal(same.events.at(-1), 'begin')
  const changed = preparation({ sessions: [session], total: 150 })
  await changed.run()
  assert.deepEqual(changed.initiated, [{ total: 150, provider }])
})
test('an existing verified payment is completed without editing its cart or opening another payment', async () => {
  const flow = preparation({ sessions: [{ provider_id: provider, status: 'pending' }], alreadyPaid: true })
  assert.equal((await flow.run()).status, 'paid')
  assert.deepEqual(flow.events, ['read', 'status'])
})
test('optional marketing failure does not block payment and explicit opt-in is preserved', async () => {
  const flow = preparation({ marketingError: true })
  const result = await flow.run(true, true)
  assert.equal(result.status, 'pending')
  assert.ok(result.marketingMessage)
  assert.ok(flow.events.includes('marketing:true'))
  assert.equal(flow.events.at(-1), 'begin')
})

test('Nedarim-only checkout uses one page instead of provider selection and a separate review page', async () => {
  let shippingOptions = []
  const Form = load('modules/checkout/templates/checkout-form/index.tsx', {
    '@lib/data/fulfillment': { listCartShippingMethods: async () => shippingOptions },
    '@lib/data/payment': { listCartPaymentMethods: async () => [{ id: provider }] },
    '@lib/constants': { isNedarim: id => id === provider },
    '@modules/checkout/components/addresses': { default: 'Addresses' },
    '@modules/checkout/components/payment': { default: 'Payment' },
    '@modules/checkout/components/review': { default: 'Review' },
    '@modules/checkout/components/shipping': { default: 'Shipping' },
    '@modules/checkout/components/checkout-steps': { default: 'Steps' },
    '@modules/checkout/components/quick-checkout': { default: 'QuickCheckout' },
    '@lib/data/nedarim': { getInstallmentPolicy: async () => ({ enabled: true, amount_per_installment: 50, max_installments: 12 }) },
  }, { process: { env: {} } }).default
  const tree = await Form({ cart: { id: 'cart_owned', total: 10, region: { id: 'reg_il' } }, customer: null })
  assert.equal(tree.type, 'QuickCheckout')
  assert.equal(tree.props.installmentPolicy.amount_per_installment, 50, 'the owner rule reaches the checkout page')
  assert.equal(nodes(tree).some(node => ['Steps', 'Payment', 'Review'].includes(node.type)), false)
  shippingOptions = [{ id: 'so_carrier', price_type: 'calculated' }]
  const quoted = await Form({ cart: { id: 'cart_owned', total: 10, region: { id: 'reg_il' } }, customer: null })
  assert.equal(nodes(quoted).some(node => node.type === 'QuickCheckout'), false)
  assert.equal(nodes(quoted).some(node => node.type === 'Addresses'), true)
})

test('quick checkout keeps terms unchecked and opens its cached payment only after the native form passes validation', async () => {
  const runtime = hooks(), calls = []
  class BrowserFormData extends FormData { constructor() { super(); this.set('shipping_option_id', 'so_chosen') } }
  const Component = load('modules/checkout/components/quick-checkout/index.tsx', {
    react: runtime.react, 'next/navigation': { usePathname: () => '/il/checkout' },
    '@modules/common/components/ui': { Heading: 'h2' },
    '@modules/common/components/localized-client-link': { default: 'a' },
    '@modules/account/components/google-auth-button': { default: 'GoogleAuthButton', CHECKOUT_DRAFT_KEY: 'draft' },
    '@modules/account/components/marketing-checkbox': { default: 'MarketingCheckbox' },
    '@lib/util/compare-addresses': { default: () => true },
    '@lib/util/money': { convertToLocale: () => '71 ₪' },
    '@lib/util/installments': { maxInstallments: () => 1, installmentPlan() {}, installmentLabel() {} },
    '@lib/data/quick-checkout': { prepareQuickCheckout: async (...args) => { calls.push(args); return payment } },
    '../shipping-address': { default: 'AddressFields' }, '../billing_address': { default: 'BillingFields' },
    '../shipping': { default: 'Shipping' }, '../nedarim-payment': { default: 'Payment' },
  }, { FormData: BrowserFormData }).default
  const props = { cart: { id: 'cart_owned', total: 71, currency_code: 'ils' }, customer: null, shippingMethods: [], checkoutPaused: false }
  let tree = nodes(runtime.render(Component, props))
  const form = tree.find(node => node.type === 'form')
  form.props.ref.current = { reportValidity: () => false }
  const terms = tree.find(node => node.type === 'input' && node.props.name === 'checkout_terms')
  assert.equal(terms.props.checked, false)
  assert.equal(terms.props.required, true)
  assert.equal(await tree.find(node => node.type === 'Payment').props.beforePayment(), false)
  assert.equal(calls.length, 0)
  terms.props.onChange({ target: { checked: true } })
  tree = nodes(runtime.render(Component, props))
  form.props.ref.current.reportValidity = () => true
  const button = tree.find(node => node.type === 'Payment')
  assert.equal(await button.props.beforePayment(), true)
  assert.equal(calls[0][1], true)
  assert.equal(calls[0][2], false)
  assert.equal(await button.props.loadPayment(), payment)
  assert.equal(calls.length, 1)
  button.props.onPaymentStarted()
  tree = nodes(runtime.render(Component, props))
  assert.equal(tree.some(node => node.type === 'form'), false)
})

test('buy now adds the selected book once and goes straight to checkout; cart errors never navigate', async () => {
  for (const fail of [false, true]) {
    const runtime = hooks(), calls = []
    const Component = load('modules/products/components/product-actions/index.tsx', {
      react: runtime.react,
      '@lib/data/cart': { addToCart: async value => { calls.push(['add', value]); if (fail) throw new Error('out of stock') } },
      '@lib/hooks/use-in-view': { useIntersection: () => true },
      '@modules/common/components/ui': { Button: 'button' },
      '@modules/common/components/divider': { default: 'hr' },
      '@modules/products/components/product-actions/option-select': { default: 'OptionSelect' },
      lodash: { isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
      'next/navigation': { useParams: () => ({ countryCode: 'il' }), usePathname: () => '/il/products/book', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: value => calls.push(['navigate', value]) }) },
      '../product-price': { default: 'Price' }, './mobile-actions': { default: 'MobileActions' },
    }).default
    const props = { product: { title: 'Book', variants: [{ id: 'variant_1', options: [], manage_inventory: false }] } }
    const tree = nodes(runtime.render(Component, props))
    const buy = tree.find(node => node.props?.['data-testid'] === 'buy-now-button')
    assert.equal(buy.props.disabled, false)
    await Promise.all([buy.props.onClick(), buy.props.onClick()])
    assert.equal(calls.filter(([name]) => name === 'add').length, 1)
    assert.deepEqual(calls.filter(([name]) => name === 'navigate'), fail ? [] : [['navigate', '/il/checkout']])
    if (fail) assert.ok(nodes(runtime.render(Component, props)).some(node => node.props?.role === 'alert'))
  }
})

test('the chosen installment count is sent to the server; a single payment is the default', async () => {
  const single = preparation()
  await single.run()
  assert.deepEqual(single.beginArgs, [[1]])
  const split = preparation()
  split.data.set('installments', '3')
  await split.run()
  assert.deepEqual(split.beginArgs, [[3]])
  const invalid = preparation()
  invalid.data.set('installments', '2.5')
  await assert.rejects(invalid.run(), /מספר התשלומים/)
  assert.deepEqual(invalid.events, [])
})

test('changing the installment count of an opened transaction opens a new payment session once', async () => {
  const flow = preparation({ begins: [{ status: 'installments_changed' }, payment] })
  flow.data.set('installments', '2')
  assert.equal((await flow.run()).payment.Key, 'test-key')
  assert.deepEqual(flow.events.slice(-4), ['begin', 'read', 'session', 'begin'])
  assert.deepEqual(flow.beginArgs, [[2], [2]])
})

test('more installments than the owner allows returns a clear message instead of opening a payment', async () => {
  const flow = preparation({ begins: [{ status: 'installments_unavailable', max_installments: 2 }] })
  flow.data.set('installments', '5')
  const result = await flow.run()
  assert.equal(result.payment, undefined)
  assert.ok(result.message.includes('עד 2 תשלומים'))
  const none = preparation({ begins: [{ status: 'installments_unavailable', max_installments: 1 }] })
  none.data.set('installments', '2')
  assert.ok((await none.run()).message.includes('תשלום אחד'))
})

test('the display rule matches the server: one installment per full configured amount, capped', () => {
  const { maxInstallments } = load('lib/util/installments.ts', {})
  const policy = { enabled: true, amount_per_installment: 50, max_installments: 12 }
  for (const [total, expected] of [[40, 1], [99.99, 1], [100, 2], [150, 3], [260, 5], [1000, 12]]) {
    assert.equal(maxInstallments(total, 'ils', policy), expected, `${total} ₪`)
  }
  assert.equal(maxInstallments(1000, 'ils', { ...policy, enabled: false }), 1)
  assert.equal(maxInstallments(1000, 'usd', policy), 1)
  assert.equal(maxInstallments(1000, 'ils', null), 1)
})

test('the checkout offers an installment choice only when the order qualifies, with exact amounts', async () => {
  const installmentsUtil = load('lib/util/installments.ts', {})
  const render = (total, policy) => {
    const runtime = hooks()
    const Component = load('modules/checkout/components/quick-checkout/index.tsx', {
      react: runtime.react, 'next/navigation': { usePathname: () => '/il/checkout' },
      '@modules/common/components/ui': { Heading: 'h2' },
      '@modules/common/components/localized-client-link': { default: 'a' },
      '@modules/account/components/google-auth-button': { default: 'GoogleAuthButton', CHECKOUT_DRAFT_KEY: 'draft' },
      '@modules/account/components/marketing-checkbox': { default: 'MarketingCheckbox' },
      '@lib/util/compare-addresses': { default: () => true },
      '@lib/util/money': { convertToLocale: ({ amount }) => `₪${amount.toFixed(2)}` },
      '@lib/util/installments': installmentsUtil,
      '@lib/data/quick-checkout': { prepareQuickCheckout: async () => payment },
      '../shipping-address': { default: 'AddressFields' }, '../billing_address': { default: 'BillingFields' },
      '../shipping': { default: 'Shipping' }, '../nedarim-payment': { default: 'Payment' },
    }).default
    const props = { cart: { id: 'cart_owned', total, currency_code: 'ils' }, customer: null, shippingMethods: [], checkoutPaused: false, installmentPolicy: policy }
    return { runtime, Component, props, tree: () => nodes(runtime.render(Component, props)) }
  }
  const policy = { enabled: true, amount_per_installment: 50, max_installments: 12 }
  const page = render(150, policy)
  let tree = page.tree()
  const select = tree.find(node => node.type === 'select')
  assert.equal(select.props.name, 'installments', 'the choice is part of the checkout form data')
  assert.equal(select.props.value, 1)
  const options = tree.filter(node => node.type === 'option')
  assert.deepEqual(options.map(option => option.props.value), [1, 2, 3])
  assert.deepEqual(options.map(option => option.props.children), ['תשלום אחד', '2 תשלומים של ₪75.00', '3 תשלומים של ₪50.00'])
  const uneven = render(100, { ...policy, amount_per_installment: 30 }).tree().filter(node => node.type === 'option')
  assert.equal(uneven[2].props.children, '3 תשלומים: הראשון ₪33.34, והשאר ₪33.33 כל אחד', 'no approximate amounts')
  select.props.onChange({ target: { value: '3' } })
  tree = page.tree()
  assert.ok(tree.some(node => node.type === 'p' && String(node.props.children).includes('כרטיס אשראי בלבד')))
  assert.equal(render(99, policy).tree().some(node => node.type === 'select'), false)
  assert.equal(render(1000, { ...policy, enabled: false }).tree().some(node => node.type === 'select'), false)
  assert.equal(render(1000, null).tree().some(node => node.type === 'select'), false)
})
