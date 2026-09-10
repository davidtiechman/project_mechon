const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

// Execute the real route with isolated backend/Next adapters, without Google credentials.
function load(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, "../src", file), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
      return dependencies[name]
    },
    Buffer, URL, process: { env: { NODE_ENV: "production" } }, console: { warn() {} },
  })
  return exports
}

class FetchError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status }
}
const token = (actor_id) => `header.${Buffer.from(JSON.stringify({ actor_id, user_metadata: { given_name: "Test", email: "test@example.com", email_verified: true } })).toString("base64url")}.signature`

function setup({ unlinked = false, noCustomer = false, profileFailure = false, authFailure = false, refreshFailure = false } = {}) {
  const calls = []
  const sdk = {
    client: { async fetch(url) {
      calls.push(url)
      if (url.endsWith("/callback")) { if (authFailure) throw new FetchError(401); return { token: token(unlinked ? undefined : "cus_1") } }
      if (url === "/auth/link-customer-google") { if (noCustomer) throw new FetchError(404); return {} }
      if (url === "/auth/token/refresh") { if (refreshFailure) throw new FetchError(500); return { token: token("cus_1") } }
      throw new Error(`Unexpected request ${url}`)
    } },
    store: { customer: {
      async retrieve() { return { customer: {} } },
      async update() { if (profileFailure) throw new FetchError(500) },
      async create() { calls.push("create") },
    } },
  }
  const route = load("app/api/auth/google/callback/route.ts", {
    "@medusajs/js-sdk": { __esModule: true, default: function () { return sdk }, FetchError },
    "next/server": { NextResponse: { redirect(destination) {
      const cookies = new Map()
      return { destination, cookies: { set(name, value, options) { cookies.set(name, { value, ...options }) }, delete(name) { cookies.delete(name) } }, savedCookies: cookies }
    } } },
    "next/cache": { revalidateTag() {} },
    "@lib/data/cookies": { async getCacheTag() { return "" } },
    "@lib/util/safe-return-path": load("lib/util/safe-return-path.ts", {}),
  })
  return { calls, run: (query = "code=test&state=test", returnTo = "/il/account") => route.GET({
    nextUrl: new URL(`https://shop.example/api/auth/google/callback?${query}`),
    cookies: { get(name) { return name === "_google_oauth_return_to" ? { value: returnTo } : undefined } },
  }) }
}

test("successful callback saves a redirect-compatible secure session and preserves destination", async () => {
  const response = await setup().run(undefined, "/il/checkout?step=address")
  assert.equal(response.destination.pathname, "/il/checkout")
  assert.equal(response.destination.search, "?step=address")
  const cookie = response.savedCookies.get("_medusa_jwt")
  assert.equal(cookie.sameSite, "lax")
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.secure, true)
  assert.equal(cookie.path, "/")
})

test("profile update failure does not discard a successful login", async () => {
  const response = await setup({ profileFailure: true }).run()
  assert.ok(response.savedCookies.has("_medusa_jwt"))
  assert.equal(response.destination.search, "")
})

for (const noCustomer of [false, true]) {
  test(`unlinked identity is ${noCustomer ? "created" : "linked"} before refreshing the session`, async () => {
    const flow = setup({ unlinked: true, noCustomer })
    const response = await flow.run()
    assert.deepEqual(flow.calls, ["/auth/customer/google/callback", "/auth/link-customer-google", ...(noCustomer ? ["create"] : []), "/auth/token/refresh"])
    assert.equal(response.savedCookies.get("_medusa_jwt").value, token("cus_1"))
  })
}

for (const options of [{ authFailure: true }, { unlinked: true, refreshFailure: true }]) {
  test(`authentication failure does not save a session: ${JSON.stringify(options)}`, async () => {
    const response = await setup(options).run()
    assert.equal(response.savedCookies.has("_medusa_jwt"), false)
    assert.equal(response.destination.searchParams.get("google_auth_error"), "failed")
  })
}

test("cancelled Google login never calls the backend", async () => {
  const flow = setup()
  const response = await flow.run("error=access_denied")
  assert.equal(response.destination.searchParams.get("google_auth_error"), "cancelled")
  assert.equal(flow.calls.length, 0)
  assert.equal(response.savedCookies.has("_medusa_jwt"), false)
})

test("account retrieval distinguishes an expired session from a backend outage", async () => {
  let status = 401
  const { retrieveCustomer } = load("lib/data/customer.ts", {
    "@lib/config": { sdk: { client: { async fetch(_url, options) { assert.equal(options.cache, "no-store"); throw new FetchError(status) } } } },
    "@lib/util/medusa-error": {}, "@medusajs/js-sdk": { FetchError },
    "next/cache": {}, "next/navigation": {},
    "./cookies": { async getAuthHeaders() { return { authorization: "Bearer test" } }, async getCacheOptions() { return {} } },
  })
  assert.equal(await retrieveCustomer({ throwOnError: true }), null)
  status = 500
  await assert.rejects(retrieveCustomer({ throwOnError: true }), /HTTP 500/)
  assert.equal(await retrieveCustomer(), null)
})
