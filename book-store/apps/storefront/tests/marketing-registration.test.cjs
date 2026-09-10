const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function setup({ verification = false, marketingFailure = false } = {}) {
  let pending = null
  let verified = !verification
  const consentRequests = []
  const dependencies = {
    '@lib/config': { sdk: {
      auth: { register: async () => 'token', login: async () => verified ? 'token' : { verification_required: true, token: 'pending' }, verification: { request: async () => {} } },
      store: { customer: { retrieve: async () => ({ customer: {} }) } },
      client: { fetch: async (url, options) => {
        if (url !== '/store/customers/me/marketing-consent') throw new Error('Unexpected request')
        consentRequests.push(options.body)
        if (marketingFailure) throw new Error('Unavailable')
        return { success: true }
      } },
    } },
    '@lib/util/medusa-error': { default: error => { throw error } },
    '@medusajs/js-sdk': { FetchError: Error },
    'next/cache': { revalidateTag() {} },
    'next/navigation': { redirect() {} },
    './cookies': {
      setPendingCustomer: async value => { pending = value }, getPendingCustomer: async () => pending,
      removePendingCustomer: async () => { pending = null }, getCartId: async () => null,
      getCacheTag: async () => '', setAuthToken: async () => {},
    },
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/data/customer.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, console: { warn() {} }, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`)
    return dependencies[name]
  } })
  return { actions: exports, consentRequests, verify() { verified = true } }
}
function form(accepted) {
  const data = new FormData()
  for (const [name, value] of Object.entries({ email: 'reader@example.com', password: 'example', first_name: 'Reader', marketing_consent_version: '2026-09-10-v1' })) data.set(name, value)
  if (accepted) data.set('marketing_consent', 'on')
  return data
}
for (const accepted of [false, true]) {
  test(`email registration persists only the explicit marketing choice: ${accepted}`, async () => {
    const flow = setup()
    assert.equal((await flow.actions.signup(null, form(accepted))).state, 'success')
    assert.equal(flow.consentRequests[0].accepted, accepted)
    assert.equal(flow.consentRequests[0].source, 'registration')
    assert.equal(flow.consentRequests[0].version, '2026-09-10-v1')
  })
}
test('marketing choice survives email verification without opting in before authentication', async () => {
  const flow = setup({ verification: true })
  assert.equal((await flow.actions.signup(null, form(true))).state, 'verification_required')
  assert.equal(flow.consentRequests.length, 0)
  flow.verify()
  assert.equal((await flow.actions.login(null, form(false))).state, 'success')
  assert.equal(flow.consentRequests[0].accepted, true)
})
test('marketing storage failure does not prevent registration', async () => {
  const flow = setup({ marketingFailure: true })
  assert.equal((await flow.actions.signup(null, form(true))).state, 'success')
})
