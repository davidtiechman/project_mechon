const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, deps, globals = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText + '\nexports.TestFrame = typeof NedarimFrame === "function" ? NedarimFrame : undefined;', {
    exports, Error, Response, setTimeout: () => 1, clearTimeout() {}, ...globals,
    require(name) {
      if (name === 'react/jsx-runtime') return require(name)
      if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`)
      return deps[name]
    },
  })
  return exports
}

function runtime() {
  let index = 0
  const values = [], effects = []
  return {
    effects,
    react: {
      useRef(initial) { const key = index++; return values[key] ??= { current: initial } },
      useState(initial) {
        const key = index++
        if (!(key in values)) values[key] = initial
        return [values[key], (next) => { values[key] = typeof next === 'function' ? next(values[key]) : next }]
      },
      useCallback(fn) { return fn },
      useEffect(fn) { effects.push(fn) },
    },
    render(Component, props) { index = 0; return Component(props) },
  }
}
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}
const file = 'modules/checkout/components/nedarim-payment/index.tsx'
const payment = { TransactionId: '900', Key: 'test-key', Methods: 'Card,GooglePay,ApplePay,Bit', ButtonText: 'תשלום' }
const installmentsUtil = load('lib/util/installments.ts', {})
const baseDeps = {
  '@modules/common/components/ui': { Button: 'button' },
  '@lib/util/money': { convertToLocale: ({ amount }) => `₪${amount.toFixed(2)}` },
  '@lib/util/installments': installmentsUtil,
  '../error-message': { default: 'ErrorMessage' },
  './processing-overlay': { default: 'ProcessingOverlay' },
}

test('iframe delegates wallets, sends the locked transaction once, and rejects messages from other origins/windows', () => {
  const hooks = runtime(), listeners = new Set(), sent = []
  const frameWindow = { postMessage: (...args) => sent.push(args) }
  let results = 0
  const { TestFrame } = load(file, { ...baseDeps, react: hooks.react, '@lib/data/nedarim': {}, '@lib/data/cart': {} }, {
    window: { addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) },
  })
  const frame = hooks.render(TestFrame, { payment, onResult: () => results++, onPending() {}, onBack() {}, onCancel() {} })
  frame.props.ref.current = { contentWindow: frameWindow }
  const cleanup = hooks.effects[0]()
  assert.equal(frame.props.src, 'https://www.matara.pro/nedarimplus/iframe/v3/')
  assert.equal(frame.props.allow, 'payment')
  assert.equal(frame.props.sandbox, undefined)
  frame.props.onLoad()
  const receive = [...listeners][0]
  receive({ origin: 'https://www.matara.pro', source: frameWindow, data: { Name: 'Ready' } })
  assert.equal(sent.length, 1)
  assert.equal(sent[0][1], 'https://www.matara.pro')
  assert.equal(sent[0][0].Value.TransactionId, '900')
  const data = { Name: 'TransactionResponse', Value: { Status: 'OK', ID: 'forged' } }
  receive({ origin: 'https://evil.example', source: frameWindow, data })
  receive({ origin: 'https://www.matara.pro', source: {}, data })
  assert.equal(results, 0)
  receive({ origin: 'https://www.matara.pro', source: frameWindow, data })
  assert.equal(results, 1)
  cleanup()
  assert.equal(listeners.size, 0)
})

const tick = () => new Promise(resolve => setImmediate(resolve))
const T = { processing: 'מעבדים את העסקה…', retry: 'לתשלום חוזר', check: 'בדיקת אישור התשלום' }
// A controllable payment page: status answers are queued, timers run on demand.
function checkout({ statuses = [], placeOrder = async () => {}, begin } = {}) {
  const hooks = runtime(), timers = [], calls = []
  let completed = 0, closed = 0, submitting = null
  const Component = load(file, {
    ...baseDeps, react: hooks.react,
    '@lib/data/nedarim': {
      beginNedarimPayment: begin || (async () => ({ status: 'pending', payment })),
      getNedarimPaymentStatus: async (verify = false) => {
        calls.push(verify)
        const next = statuses.length > 1 ? statuses.shift() : statuses[0]
        if (next instanceof Error) throw next
        return next || { status: 'pending' }
      },
    },
    '@lib/data/cart': { placeOrder: async () => { completed++; return placeOrder() } },
  }, { setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length }, clearTimeout() {} }).default
  const props = { notReady: false, beforePayment: async () => true, onSubmittingChange(v) { submitting = v }, onPaymentClosed() { closed++ } }
  const tree = () => nodes(hooks.render(Component, props))
  const api = {
    hooks, timers, calls, props, tree,
    get completed() { return completed }, get closed() { return closed }, get submitting() { return submitting },
    frame: () => tree().find(node => typeof node.type === 'function'),
    button: label => tree().find(node => node.type === 'button' && (!label || node.props.children === label)),
    error: () => tree().find(node => node.type === 'ErrorMessage').props.error,
    overlay: () => tree().find(node => node.type === 'ProcessingOverlay'),
    async open() { await api.button().props.onClick(); tree() },
    // Runs the waits between server checks (3s each) and lets the checks resolve.
    async advance(delay = 3000, rounds = 1) {
      for (let i = 0; i < rounds; i++) {
        const index = timers.findIndex(timer => timer.delay === delay)
        if (index < 0) return
        timers.splice(index, 1)[0].fn()
        await tick(); await tick()
      }
    },
  }
  return api
}

test('browser success only triggers a server check; the order waits for server-confirmed payment', async () => {
  const page = checkout({ statuses: [{ status: 'pending', provider: 'unknown' }, { status: 'paid' }] })
  await page.open()
  page.frame().props.onResult()
  await tick(); await tick()
  assert.deepEqual(page.calls, [true], 'the success message must ask the server to verify with Nedarim')
  assert.equal(page.completed, 0)
  assert.equal(page.overlay().props.label, T.processing)
  await page.advance()
  assert.equal(page.completed, 1)
})

test('processing blocks a repeat payment, ignores duplicate events, and keeps bit QR codes usable', async () => {
  const page = checkout({ statuses: [{ status: 'pending', provider: 'unknown' }] })
  await page.open()
  page.frame().props.onPending()
  assert.equal(page.overlay(), undefined, 'bit and bank transfer must keep their QR/link usable while waiting in the provider iframe')
  page.frame().props.onResult()
  page.frame().props.onResult()
  await tick()
  assert.equal(page.calls.length, 1)
  const tree = page.tree()
  assert.ok(page.overlay())
  assert.ok(tree.some(node => node.type === 'div' && node.props.inert === true))
  assert.equal(tree.some(node => node.props?.['data-testid'] === 'submit-order-button'), false)
})

test('when Nedarim cannot answer, the customer is told the confirmation is delayed, never that it failed', async () => {
  const page = checkout({ statuses: [{ status: 'pending', provider: 'unknown' }] })
  await page.open()
  page.frame().props.onResult()
  await tick(); await tick()
  await page.advance(3000, 40)
  assert.equal(page.calls.length, 30)
  assert.equal(page.overlay(), undefined)
  assert.equal(page.error(), null)
  assert.ok(page.button(T.check), 'a status check remains available')
  assert.equal(page.tree().some(node => node.props?.['data-testid'] === 'submit-order-button'), false, 'no second payment may be offered')
  assert.equal(page.frame(), undefined)
  assert.equal(page.completed, 0)
})

test('a success message that Nedarim reports as not executed returns to checkout with a retry', async () => {
  const page = checkout({ statuses: [{ status: 'pending', provider: 'not_paid' }] })
  await page.open()
  page.frame().props.onResult()
  await tick(); await tick()
  await page.advance(3000, 40)
  assert.ok(page.error().includes('לא בוצע חיוב'))
  assert.ok(page.button(T.retry))
  assert.equal(page.closed, 1)
})

test('a decline is shown only after Nedarim confirms it, then returns to checkout with "pay again"', async () => {
  const page = checkout({ statuses: [{ status: 'pending', provider: 'not_paid' }] })
  await page.open()
  page.frame().props.onError(false)
  await tick(); await tick()
  assert.deepEqual(page.calls, [true])
  assert.ok(page.error().includes('העסקה לא בוצעה'))
  assert.equal(page.frame(), undefined, 'the payment window closes')
  assert.ok(page.button(T.retry))
  assert.equal(page.closed, 1, 'the checkout form is shown again')
  assert.equal(page.submitting, false)
  await page.button(T.retry).props.onClick()
  assert.ok(page.frame(), 'retrying reopens the same server transaction')
})

test('a decline that Nedarim reports as paid completes the order instead', async () => {
  const page = checkout({ statuses: [{ status: 'paid' }] })
  await page.open()
  page.frame().props.onError(false)
  await tick(); await tick()
  assert.equal(page.completed, 1)
  assert.equal(page.error(), null)
})

test('an error that only needs more input in the iframe does not close the payment window', async () => {
  const page = checkout()
  await page.open()
  page.frame().props.onError(true)
  await tick()
  assert.equal(page.calls.length, 0)
  assert.ok(page.frame())
})

test('an abandoned payment window closes after the timeout and a server check', async () => {
  const page = checkout({ statuses: [{ status: 'pending', provider: 'not_paid' }] })
  await page.open()
  for (const effect of page.hooks.effects.splice(0)) effect()
  await page.advance(10 * 60_000)
  assert.ok(page.calls.includes(true))
  assert.ok(page.error().includes('זמן התשלום הסתיים'))
  assert.ok(page.button(T.retry))
})

test('a network failure during a decline check is not reported as a failed payment', async () => {
  const page = checkout({ statuses: [new Error('offline')] })
  await page.open()
  page.frame().props.onError(false)
  await tick(); await tick()
  await page.advance(3000, 5)
  assert.equal(page.error(), null)
  assert.ok(page.button(T.check))
})

test('processing uses a native modal to block the page, prevent Escape, and restore scrolling on exit', () => {
  const hooks = runtime()
  const body = { style: { overflow: 'auto' } }
  let opened = 0, closed = 0, canceled = 0
  const Component = load('modules/checkout/components/nedarim-payment/processing-overlay.tsx', { react: hooks.react }, { document: { body } }).default
  const dialog = hooks.render(Component, { label: 'מאמתים את התשלום…' })
  dialog.props.ref.current = { showModal() { opened++ }, close() { closed++ } }
  const cleanup = hooks.effects[0]()
  assert.equal(opened, 1)
  assert.equal(body.style.overflow, 'hidden')
  assert.equal(dialog.type, 'dialog')
  assert.equal(dialog.props['aria-modal'], 'true')
  dialog.props.onCancel({ preventDefault() { canceled++ } })
  assert.equal(canceled, 1)
  cleanup()
  assert.equal(closed, 1)
  assert.equal(body.style.overflow, 'auto')
})

test('the iframe cannot open before the server has saved the required checkout consent', async () => {
  const hooks = runtime()
  let opened = 0
  const Component = load(file, {
    ...baseDeps, react: hooks.react,
    '@lib/data/nedarim': { beginNedarimPayment: async () => { opened++; return { status: 'pending', payment } } },
    '@lib/data/cart': {},
  }).default
  const tree = nodes(hooks.render(Component, { notReady: false, beforePayment: async () => false, onSubmittingChange() {} }))
  await tree.find(node => node.type === 'button').props.onClick()
  assert.equal(opened, 0)
})

test('an already paid checkout can retry order completion without reopening payment or resubmitting the form', async () => {
  const hooks = runtime()
  let opened = 0, saved = 0, completed = 0
  const Component = load(file, {
    ...baseDeps, react: hooks.react,
    '@lib/data/nedarim': {
      beginNedarimPayment: async () => { opened++; return { status: 'paid' } },
      getNedarimPaymentStatus: async () => ({ status: 'paid' }),
    },
    '@lib/data/cart': { placeOrder: async () => { completed++; throw new Error('temporary order completion failure') } },
  }).default
  const props = { notReady: false, beforePayment: async () => { saved++; return true }, onSubmittingChange() {} }
  let tree = nodes(hooks.render(Component, props))
  await tree.find(node => node.props?.['data-testid'] === 'submit-order-button').props.onClick()
  tree = nodes(hooks.render(Component, props))
  assert.equal(tree.some(node => node.props?.['data-testid'] === 'submit-order-button'), false)
  const retry = tree.find(node => node.type === 'button')
  assert.ok(retry)
  await retry.props.onClick()
  assert.equal(opened, 1)
  assert.equal(saved, 1)
  assert.equal(completed, 2)
})

test('Apple domain association serves the exact configured public file and fails closed when absent', async () => {
  const environment = { env: {} }
  const route = load('app/.well-known/apple-developer-merchantid-domain-association/route.ts', {}, { process: environment })
  assert.equal((await route.GET()).status, 404)
  environment.env.NEDARIM_APPLE_PAY_DOMAIN_ASSOCIATION = 'provider-file\nexact-bytes'
  const response = await route.GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('location'), null)
  assert.equal(await response.text(), 'provider-file\nexact-bytes')
})

test('a paused local checkout displays its reason and cannot start a payment', async () => {
  const hooks = runtime()
  let opened = 0
  const Component = load(file, {
    ...baseDeps, react: hooks.react,
    '@lib/data/nedarim': { beginNedarimPayment: async () => { opened++; return { status: 'pending', payment } } },
    '@lib/data/cart': {},
  }).default
  const tree = nodes(hooks.render(Component, { notReady: false, checkoutPaused: true, beforePayment: async () => true, onSubmittingChange() {} }))
  const button = tree.find(node => node.type === 'button')
  assert.equal(button.props.disabled, true)
  await button.props.onClick()
  assert.equal(opened, 0)
  assert.ok(tree.some(node => node.props?.role === 'status' && typeof node.props.children === 'string' && node.props.children.includes('מושהית')))
})

test('an installment payment shows its exact split next to the payment window', async () => {
  const plan = { count: 3, first: 60, next: 60, currency_code: 'ils' }
  const page = checkout({ begin: async () => ({ status: 'pending', payment: { ...payment, ButtonText: 'תשלום ב־3 תשלומים' }, plan }) })
  await page.open()
  const summary = page.tree().find(node => node.props?.['data-testid'] === 'installments-summary')
  assert.equal(summary.props.children, 'תשלום ב־3 תשלומים של ₪60.00, בכרטיס אשראי')
  const uneven = checkout({ begin: async () => ({ status: 'pending', payment, plan: { count: 3, first: 33.34, next: 33.33, currency_code: 'ils' } }) })
  await uneven.open()
  assert.equal(uneven.tree().find(node => node.props?.['data-testid'] === 'installments-summary').props.children,
    'תשלום ב־3 תשלומים: הראשון ₪33.34, והשאר ₪33.33 כל אחד, בכרטיס אשראי')
  const single = checkout()
  await single.open()
  assert.equal(single.tree().some(node => node.props?.['data-testid'] === 'installments-summary'), false)
})

test('the order confirmation says the payment was made in installments, with the split Nedarim reported', () => {
  const Details = load('modules/order/components/payment-details/index.tsx', {
    '@modules/common/components/ui': { Container: 'div', Heading: 'h2', Text: 'p' },
    '@lib/constants': { isStripeLike: () => false, paymentInfoMap: { pp_nedarim_nedarim: { title: 'תשלום', icon: 'icon' } } },
    '@modules/common/components/divider': { default: 'hr' },
    '@lib/util/money': { convertToLocale: ({ amount }) => `₪${amount.toFixed(2)}` },
    '@lib/util/installments': installmentsUtil,
  }).default
  const order = data => ({ currency_code: 'ils', payment_collections: [{ payments: [{ provider_id: 'pp_nedarim_nedarim', amount: 180, created_at: '2026-11-26T00:04:00Z', data }] }] })
  const text = data => nodes(Details({ order: order(data) })).find(node => node.props?.['data-testid'] === 'payment-installments')?.props.children
  assert.equal(text({ installments: 3, first_installment: 60, next_installment: 60 }), 'שולם ב־3 תשלומים של ₪60.00')
  assert.equal(text({ installments: 3, first_installment: 33.34, next_installment: 33.33 }), 'שולם ב־3 תשלומים: הראשון ₪33.34, והשאר ₪33.33 כל אחד')
  assert.equal(text({ installments: 3 }), 'שולם ב־3 תשלומים')
  assert.equal(text({ attempt_id: 'ndp_x' }), undefined)
})
