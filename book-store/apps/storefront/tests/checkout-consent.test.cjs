const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '../src')

function load(file, dependencies) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, Error, require(name) {
    if (name === 'react/jsx-runtime') return require(name)
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return exports
}
function hooks() {
  let index = 0
  const values = []
  const react = {
    useState(initial) {
      const key = index++
      if (!(key in values)) values[key] = initial
      return [values[key], value => { values[key] = value }]
    },
    useRef(initial) {
      const key = index++
      if (!(key in values)) values[key] = { current: initial }
      return values[key]
    },
  }
  return { react, render(Component, props) { index = 0; return Component(props) } }
}
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}
const consent = load('lib/checkout-consent.ts', {})
const cart = { shipping_address: {}, billing_address: {}, email: 'test@example.com', shipping_methods: [{}], payment_collection: { payment_sessions: [{ provider_id: 'manual', status: 'pending', data: {} }] } }

test('checkbox starts unchecked, shows required error, then submits the explicit version', async () => {
  const runtime = hooks()
  const calls = []
  const marketingCalls = []
  let marketingFails = false
  const Review = load('modules/checkout/components/review/index.tsx', {
    react: runtime.react,
    '@modules/common/components/ui': { Heading: 'h2', clx: () => '' },
    '../payment-button': { default: 'PaymentButton' },
    'next/navigation': { useSearchParams: () => new URLSearchParams('step=review') },
    '@lib/checkout-consent': consent,
    '@lib/data/checkout-consent': { acceptCheckoutTerms: async (...args) => calls.push(args) },
    '@modules/account/components/marketing-checkbox': { default: 'MarketingCheckbox' },
    '@lib/marketing-consent': { MARKETING_CONSENT_VERSION: '2026-09-10-v1' },
    '@lib/data/marketing-consent': { saveCheckoutMarketingConsent: async (...args) => {
      marketingCalls.push(args)
      if (marketingFails) throw new Error('Marketing storage unavailable')
    } },
  }).default
  let tree = nodes(runtime.render(Review, { cart }))
  const input = tree.find(node => node.type === 'input')
  assert.equal(input.props.checked, false)
  assert.equal(input.props.required, true)
  assert.equal(tree.find(node => node.type === 'MarketingCheckbox').props.checked, false)
  assert.deepEqual(tree.filter(node => node.type === 'a').map(node => node.props.href), [
    '/il/pages/terms-of-purchase', '/il/pages/shipping-returns', '/il/pages/privacy-accessibility',
  ])
  assert.equal(await tree.find(node => node.type === 'PaymentButton').props.beforePayment(), false)
  assert.equal(calls.length, 0)
  tree = nodes(runtime.render(Review, { cart }))
  assert.equal(tree.find(node => node.props?.role === 'alert').props.children, consent.CHECKOUT_CONSENT_ERROR)
  tree.find(node => node.type === 'input').props.onChange({ target: { checked: true } })
  tree = nodes(runtime.render(Review, { cart }))
  assert.equal(await tree.find(node => node.type === 'PaymentButton').props.beforePayment(), true)
  assert.deepEqual(calls, [[true, consent.CHECKOUT_TERMS_VERSION]])
  assert.deepEqual(marketingCalls, [[false, '2026-09-10-v1']])
  tree.find(node => node.type === 'MarketingCheckbox').props.onChange(true)
  tree = nodes(runtime.render(Review, { cart }))
  assert.equal(await tree.find(node => node.type === 'PaymentButton').props.beforePayment(), true)
  assert.deepEqual(marketingCalls.at(-1), [true, '2026-09-10-v1'])
  marketingFails = true
  assert.equal(await tree.find(node => node.type === 'PaymentButton').props.beforePayment(), true)
  tree.find(node => node.type === 'input').props.onChange({ target: { checked: false } })
  tree = nodes(runtime.render(Review, { cart }))
  assert.equal(await tree.find(node => node.type === 'PaymentButton').props.beforePayment(), false)
})

for (const provider of ['manual', 'stripe']) {
  for (const approved of [false, true, 'failure']) {
    test(`${provider}: consent ${approved} gates payment and completion`, async () => {
      const runtime = hooks()
      const events = []
      const PaymentButton = load('modules/checkout/components/payment-button/index.tsx', {
        react: runtime.react,
        '@lib/constants': { isManual: id => id === 'manual', isStripeLike: id => id === 'stripe' },
        '@lib/data/cart': { placeOrder: async () => { events.push('order') } },
        '@modules/common/components/ui': { Button: 'button' },
        '../error-message': { default: 'ErrorMessage' },
        '@stripe/react-stripe-js': {
          useStripe: () => ({ confirmCardPayment: async () => { events.push('charge'); return { paymentIntent: { status: 'succeeded' } } } }),
          useElements: () => ({ getElement: () => ({}) }),
        },
      }).default
      const paymentCart = { ...cart, payment_collection: { payment_sessions: [{ provider_id: provider, status: 'pending', data: {} }] } }
      const child = PaymentButton({ cart: paymentCart, 'data-testid': 'submit-order-button', onSubmittingChange() {}, beforePayment: async () => {
        events.push('consent')
        if (approved === 'failure') throw new Error('Consent save failed')
        return approved
      } })
      const tree = nodes(runtime.render(child.type, child.props))
      await tree.find(node => node.type === 'button').props.onClick()
      assert.deepEqual(events, approved === true ? (provider === 'stripe' ? ['consent', 'charge', 'order'] : ['consent', 'order']) : ['consent'])
    })
  }
}

test('backend and storefront use the same fixed terms version', () => {
  const backend = fs.readFileSync(path.join(__dirname, '../../backend/src/lib/checkout-consent.ts'), 'utf8')
  assert.match(backend, new RegExp(`CHECKOUT_TERMS_VERSION = "${consent.CHECKOUT_TERMS_VERSION}"`))
})

test('marketing checkbox is optional and uses the specified version and wording', () => {
  const marketing = load('lib/marketing-consent.ts', {})
  const Component = load('modules/account/components/marketing-checkbox/index.tsx', { '@lib/marketing-consent': marketing }).default
  const tree = nodes(Component({ checked: false, onChange() {} }))
  const checkbox = tree.find(node => node.type === 'input' && node.props.type === 'checkbox')
  assert.equal(checkbox.props.checked, false)
  assert.equal(checkbox.props.required, undefined)
  assert.ok(tree.some(node => node.type === 'span' && node.props.children === marketing.MARKETING_CONSENT_TEXT))
  const backend = fs.readFileSync(path.join(__dirname, '../../backend/src/lib/marketing-consent.ts'), 'utf8')
  assert.ok(backend.includes(`MARKETING_CONSENT_VERSION = "${marketing.MARKETING_CONSENT_VERSION}"`))
})
