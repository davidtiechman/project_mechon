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
        return [values[key], (next) => { values[key] = next }]
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
const baseDeps = {
  '@modules/common/components/ui': { Button: 'button' },
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

test('browser success only asks the server; order completion waits for a server-confirmed payment', async () => {
  const hooks = runtime()
  let serverStatus = 'pending', completed = 0, statusChecks = 0
  const Component = load(file, {
    ...baseDeps, react: hooks.react,
    '@lib/data/nedarim': {
      beginNedarimPayment: async () => ({ status: 'pending', payment }),
      getNedarimPaymentStatus: async () => { statusChecks++; return { status: serverStatus } },
    },
    '@lib/data/cart': { placeOrder: async () => { completed++ } },
  }).default
  const props = { notReady: false, beforePayment: async () => true, onSubmittingChange() {} }
  let tree = nodes(hooks.render(Component, props))
  await tree.find(node => node.type === 'button').props.onClick()
  tree = nodes(hooks.render(Component, props))
  const iframeComponent = tree.find(node => typeof node.type === 'function')
  iframeComponent.props.onResult()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(statusChecks, 1)
  assert.equal(completed, 0)
  serverStatus = 'paid'
  iframeComponent.props.onResult()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(completed, 1)
})

test('verification blocks repeat payment, shares concurrent status checks, and a timeout stays pending', async () => {
  const hooks = runtime(), timers = []
  let checks = 0, completed = 0, resolveStatus
  const response = new Promise(resolve => { resolveStatus = resolve })
  const Component = load(file, {
    ...baseDeps, react: hooks.react,
    '@lib/data/nedarim': {
      beginNedarimPayment: async () => ({ status: 'pending', payment }),
      getNedarimPaymentStatus: async () => { checks++; return response },
    },
    '@lib/data/cart': { placeOrder: async () => { completed++ } },
  }, { setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length } }).default
  const props = { notReady: false, beforePayment: async () => true, onSubmittingChange() {} }
  await nodes(hooks.render(Component, props)).find(node => node.type === 'button').props.onClick()
  let tree = nodes(hooks.render(Component, props))
  const frame = tree.find(node => typeof node.type === 'function')
  frame.props.onPending()
  assert.equal(nodes(hooks.render(Component, props)).some(node => node.type === 'ProcessingOverlay'), false,
    'bit and bank transfer must keep their QR/link usable while waiting in the provider iframe')
  frame.props.onResult()
  frame.props.onResult()
  assert.equal(checks, 1)
  tree = nodes(hooks.render(Component, props))
  assert.ok(tree.some(node => node.type === 'ProcessingOverlay'))
  assert.ok(tree.some(node => node.type === 'div' && node.props.inert === true))
  assert.equal(tree.some(node => node.props?.['data-testid'] === 'submit-order-button'), false)
  resolveStatus({ status: 'pending' })
  await new Promise(resolve => setImmediate(resolve))
  for (const effect of hooks.effects) effect()
  const watchdog = timers.find(timer => timer.delay === 60_000)
  assert.ok(watchdog)
  watchdog.fn()
  tree = nodes(hooks.render(Component, props))
  assert.equal(tree.some(node => node.type === 'ProcessingOverlay'), false)
  assert.ok(tree.some(node => node.type === 'div' && node.props.inert === true))
  assert.ok(tree.some(node => node.type === 'button' && node.props.children === 'בדיקת אישור התשלום'))
  assert.equal(tree.find(node => node.type === 'ErrorMessage').props.error, null)
  assert.equal(completed, 0)
})

test('a card decline can display failure, but a server-confirmed payment takes precedence', async () => {
  for (const status of ['pending', 'paid']) {
    const hooks = runtime()
    let completed = 0
    const Component = load(file, {
      ...baseDeps, react: hooks.react,
      '@lib/data/nedarim': { beginNedarimPayment: async () => ({ status: 'pending', payment }), getNedarimPaymentStatus: async () => ({ status }) },
      '@lib/data/cart': { placeOrder: async () => { completed++ } },
    }).default
    const props = { notReady: false, beforePayment: async () => true, onSubmittingChange() {} }
    await nodes(hooks.render(Component, props)).find(node => node.type === 'button').props.onClick()
    nodes(hooks.render(Component, props)).find(node => typeof node.type === 'function').props.onError(false)
    await new Promise(resolve => setImmediate(resolve))
    const tree = nodes(hooks.render(Component, props))
    const error = tree.find(node => node.type === 'ErrorMessage').props.error
    assert.equal(Boolean(error?.includes('לא התבצע בהצלחה')), status === 'pending')
    assert.equal(completed, status === 'paid' ? 1 : 0)
  }
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
