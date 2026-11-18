/** @jest-environment ./integration-tests/nedarim-environment.cjs */
import { createHmac, randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow, createRegionsWorkflow, createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow, createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { CHECKOUT_TERMS_VERSION } from "../../src/lib/checkout-consent"
import NedarimPaymentsService from "../../src/modules/nedarim-payments/service"
import { activeNedarimSession, loadNedarimCart } from "../../src/lib/nedarim-checkout"
import completeNedarimOrders from "../../src/jobs/nedarim-complete-orders"
import reconcileNedarim from "../../src/jobs/nedarim-reconcile"
import recoverNedarimPayment from "../../src/scripts/recover-nedarim-payment"

// Node loads this dependency's mixed CJS/ESM tree correctly; Jest's VM resolver does not.
// Keep the actual sanitizer rather than replacing its security behavior with a mock.
jest.mock("sanitize-html", () => globalThis["__nedarimActualSanitizeHtml"])

jest.setTimeout(180_000)

// Guard destructive framework test setup even when the suite is invoked without its wrapper.
if (process.env.DB_HOST !== "localhost" || process.env.DB_USERNAME !== "nedarim_test" || process.env.NEDARIM_MOSAD !== "1234567") {
  throw new Error("Run only with npm run test:nedarim:local against the isolated local test database")
}

medusaIntegrationTestRunner({
  moduleName: "nedarim-local", dbName: "medusa-nedarim-local-integration", inApp: true,
  testSuite: ({ api, getContainer }) => {
    let container: any, ledger: NedarimPaymentsService
    let regionId: string, channelId: string, variantId: string, headers: Record<string, string>
    let upstreamRequests: URLSearchParams[] = [], transactionId = 9000
    let historyRows: Record<string, unknown>[] = [], historyReads = 0
    const originalFetch = global.fetch

    beforeAll(async () => {
      container = getContainer()
      ledger = container.resolve("nedarimPayments")
      jest.spyOn(container.resolve(Modules.NOTIFICATION), "createNotifications").mockResolvedValue([])
      // Only the external payment processor is simulated. HTTP routing, module loading,
      // migrations, queries, workflow hooks and PostgreSQL constraints are real.
      global.fetch = jest.fn(async (url, options) => {
        if (String(url).startsWith("https://matara.pro/nedarimplus/Reports/Manage3.aspx?")) {
          historyReads++
          return new Response(JSON.stringify(historyRows), { status: 200, headers: { "Content-Type": "application/json" } })
        }
        if (String(url) !== "https://matara.pro/nedarimplus/V6/Files/WebServices/DebitIframe.aspx?Action=CreateTransaction") {
          throw new Error("Unexpected external network request in local payment integration test")
        }
        upstreamRequests.push(new URLSearchParams(String(options?.body)))
        return new Response(JSON.stringify({ Status: "OK", ID: String(++transactionId), Key: "local-test-key" }), {
          status: 200, headers: { "Content-Type": "application/json" },
        })
      })
      const { result: [channel] } = await createSalesChannelsWorkflow(container).run({ input: { salesChannelsData: [{ name: "Nedarim local test" }] } })
      channelId = channel.id
      const { result: [region] } = await createRegionsWorkflow(container).run({ input: { regions: [{ name: "Nedarim local Israel", currency_code: "ils", countries: ["il"], payment_providers: ["pp_nedarim_nedarim"] }] } })
      regionId = region.id
      const { result: [key] } = await createApiKeysWorkflow(container).run({ input: { api_keys: [{ title: "Nedarim local test", type: "publishable", created_by: "" }] } })
      await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: key.id, add: [channelId] } })
      headers = { "x-publishable-api-key": key.token }
      const product = await container.resolve(Modules.PRODUCT).createProducts({
        title: "Local integration test book", status: "published",
        variants: [{ title: "Test edition", sku: "nedarim-local-test", manage_inventory: false }],
      })
      variantId = product.variants[0].id
    })

    beforeEach(() => { upstreamRequests = []; historyRows = []; historyReads = 0 })
    afterAll(() => { global.fetch = originalFetch; jest.restoreAllMocks() })

    async function checkout() {
      const carts = container.resolve(Modules.CART)
      const address = { first_name: "Local", last_name: "Test", address_1: "Test street 1", city: "Jerusalem", country_code: "il", phone: "0501234567" }
      const cart = await carts.createCarts({ region_id: regionId, sales_channel_id: channelId, currency_code: "ils", email: "buyer@example.com", shipping_address: address, billing_address: address })
      await carts.addLineItems(cart.id, [{ title: "Local test book", variant_id: variantId, quantity: 1, unit_price: 123.45, requires_shipping: false }])
      await carts.addShippingMethods(cart.id, [{ name: "Local test delivery", amount: 10, shipping_option_id: "so_local_test" }])
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({ input: { cart_id: cart.id } })
      const initialized = await api.post(`/store/payment-collections/${collection.id}/payment-sessions`, {
        provider_id: "pp_nedarim_nedarim", data: { Status: "OK", paid: true, amount: 1, attempt_id: "forged" },
      }, { headers })
      const session = initialized.data.payment_collection.payment_sessions[0]
      await api.post(`/store/carts/${cart.id}/terms-acceptance`, { accepted: true, terms_version: CHECKOUT_TERMS_VERSION }, { headers })
      return { cartId: cart.id, sessionId: session.id, attemptId: session.data.attempt_id, collectionId: collection.id }
    }

    async function preparedCheckout() {
      const checkoutData = await checkout()
      const started = await api.post(`/store/carts/${checkoutData.cartId}/nedarim`, {}, { headers, validateStatus: () => true })
      if (started.status !== 200) {
        const cart = await loadNedarimCart(container, checkoutData.cartId)
        const session = activeNedarimSession(cart)
        const attempt = await ledger.retrieveNedarimAttempt(checkoutData.attemptId)
        throw new Error(`Local payment preparation failed: ${JSON.stringify({ response: started.data, total: cart.total,
          session: { id: session?.id, provider_id: session?.provider_id, amount: session?.amount, currency_code: session?.currency_code, attempt_id: session?.data?.attempt_id },
          attempt: { id: attempt.id, session_id: attempt.session_id, amount_minor: attempt.amount_minor, currency_code: attempt.currency_code, canceled_at: attempt.canceled_at } })}`)
      }
      return { ...checkoutData, payment: started.data.payment }
    }

    function callback(payment: { attemptId: string; payment: { TransactionId: string } }, changes = {}, signed = true, duplicateTransactionId = false) {
      const payload = { Status: "OK", ID: "100001", TransactionId: payment.payment.TransactionId, Param2: payment.attemptId,
        MosadNumber: "1234567", Amount: "133.45", Currency: "1", Confirmation: "123456", PaymentMethod: "Card", Tashloumim: "1", ...changes }
      const body = duplicateTransactionId
        ? `{"TransactionId":${JSON.stringify(payment.payment.TransactionId)},${JSON.stringify({ ...payload, TransactionId: payload.ID }).slice(1)}`
        : JSON.stringify(payload)
      const timestamp = String(Math.floor(Date.now() / 1000))
      const signedHeaders = signed ? {
        "x-nedarim-timestamp": timestamp,
        "x-nedarim-signature": `v1=${createHmac("sha256", process.env.NEDARIM_WEBHOOK_SECRET!).update(timestamp + ".").update(body).digest("hex")}`,
      } : {}
      return api.post(`/hooks/nedarim/${payment.attemptId}/${payment.payment.TransactionId}`, body, {
        headers: { "Content-Type": "application/json", ...signedHeaders }, validateStatus: () => true,
      })
    }

    it("boots the real provider and locks the server total including shipping; repeated preparation reuses the transaction", async () => {
      const payment = await preparedCheckout()
      expect(payment.attemptId).toMatch(/^ndp_[a-f0-9]{32}$/)
      expect(upstreamRequests).toHaveLength(1)
      expect(upstreamRequests[0].get("Amount")).toBe("133.45")
      expect(upstreamRequests[0].get("Param2")).toBe(payment.attemptId)
      expect(upstreamRequests[0].has("Param1")).toBe(false)
      const repeat = await api.post(`/store/carts/${payment.cartId}/nedarim`, {}, { headers })
      expect(repeat.data.payment.TransactionId).toBe(payment.payment.TransactionId)
      expect(upstreamRequests).toHaveLength(1)
      expect((await api.get(`/store/carts/${payment.cartId}/nedarim`, { headers })).data.status).toBe("pending")
    })

    it("rejects unsigned, underpaid and unrelated callbacks and blocks direct unpaid order completion", async () => {
      const payment = await preparedCheckout()
      expect((await callback(payment, {}, false)).status).toBe(401)
      expect((await callback(payment, { Amount: "1" })).status).toBe(400)
      expect((await callback(payment, { Param2: "other-attempt" })).status).toBe(400)
      expect((await ledger.retrieveNedarimAttempt(payment.attemptId)).paid_at).toBeNull()
      const completed = await api.post(`/store/carts/${payment.cartId}/complete`, {}, { headers, validateStatus: () => true })
      expect(completed.data.type).not.toBe("order")
      const { data: orders } = await container.resolve("query").graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: payment.cartId } })
      expect(orders).toHaveLength(0)
    })

    it.each(["Card", "GooglePay", "ApplePay", "Bit"])("completes exactly one captured order after a signed %s callback", async (method) => {
      const payment = await preparedCheckout()
      const changes = { PaymentMethod: method, Confirmation: method === "Bit" ? "" : "123456" }
      const replies = await Promise.all([callback(payment, changes), callback(payment, changes)])
      expect(replies.map(r => r.status)).toEqual([200, 200])
      expect((await api.get(`/store/carts/${payment.cartId}/nedarim`, { headers })).data.status).toBe("paid")
      const completed = await api.post(`/store/carts/${payment.cartId}/complete`, {}, { headers })
      expect(completed.data.type).toBe("order")
      const repeated = await api.post(`/store/carts/${payment.cartId}/complete`, {}, { headers })
      expect(repeated.data.order.id).toBe(completed.data.order.id)
      const { data: orders } = await container.resolve("query").graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: payment.cartId } })
      expect(orders).toHaveLength(1)
      const payments = await container.resolve(Modules.PAYMENT).listPayments({ payment_session_id: payment.sessionId })
      expect(payments).toHaveLength(1)
      expect(payments[0].captured_at).not.toBeNull()
      expect(upstreamRequests).toHaveLength(1)
    })

    it("accepts the live provider's two TransactionId members without losing payment binding or idempotency", async () => {
      const payment = await preparedCheckout()
      expect((await callback(payment, {}, true, true)).status).toBe(200)
      expect((await callback(payment, {}, true, true)).status).toBe(200)
      const attempt = await ledger.retrieveNedarimAttempt(payment.attemptId)
      expect(attempt.transaction_id).toBe(payment.payment.TransactionId)
      expect(attempt.payment_id).toBe("100001")
      await completeNedarimOrders(container)
      const { data: orders } = await container.resolve("query").graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: payment.cartId } })
      expect(orders).toHaveLength(1)
      expect(upstreamRequests).toHaveLength(1)
    })

    it("allows only one concurrent creation lease and rejects a stale lease", async () => {
      const attempt = await ledger.createNedarimAttempts({ session_id: `payses_${randomUUID()}`, amount_minor: 1000, currency_code: "ils" })
      const claims = await Promise.all(Array.from({ length: 8 }, () => ledger.claimCreation(attempt.id, "cart_test")))
      const winner = claims.find(Boolean)!
      expect(claims.filter(Boolean)).toHaveLength(1)
      await ledger.updateNedarimAttempts({ id: attempt.id, creation_started_at: new Date(Date.now() - 120_000) })
      const replacement = await ledger.claimCreation(attempt.id, "cart_test")
      expect(replacement).toBeTruthy()
      expect(await ledger.finishCreation(attempt.id, winner, { transaction_id: "old", transaction_key: "old-key" })).toBe(false)
      expect(await ledger.finishCreation(attempt.id, replacement!, { transaction_id: "new", transaction_key: "new-key" })).toBe(true)
    })

    it("enforces unique provider payment IDs in PostgreSQL across separate attempts", async () => {
      const attempts = await ledger.createNedarimAttempts([
        { session_id: "payses_a", amount_minor: 1000, currency_code: "ils" },
        { session_id: "payses_b", amount_minor: 1000, currency_code: "ils" },
      ])
      const results = await Promise.allSettled(attempts.map(a => ledger.recordPayment(a.id, "duplicate-provider-id", "Card")))
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1)
    })

    it("completes a paid order through the background job when the browser never returns", async () => {
      const payment = await preparedCheckout()
      expect((await callback(payment)).status).toBe(200)
      await completeNedarimOrders(container)
      await completeNedarimOrders(container)
      const attempt = await ledger.retrieveNedarimAttempt(payment.attemptId)
      expect(attempt.processed_at).not.toBeNull()
      const { data: orders } = await container.resolve("query").graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: payment.cartId } })
      expect(orders).toHaveLength(1)
    })

    it("recovers a missing callback from authenticated history and applies the shared database rate limit", async () => {
      const payment = await preparedCheckout()
      historyRows = [{ TransactionId: "100002", Comments: `Mechon ${payment.attemptId}`, Amount: "133.45", Currency: "1", Confirmation: "123456", Solek: "1" }]
      process.env.NEDARIM_API_PASSWORD = "npk_local_test_only"
      try {
        await Promise.all(Array.from({ length: 5 }, () => reconcileNedarim(container)))
        expect(historyReads).toBe(1)
        const attempt = await ledger.retrieveNedarimAttempt(payment.attemptId)
        expect(attempt.payment_id).toBe("100002")
        expect(attempt.paid_at).not.toBeNull()
        await reconcileNedarim(container)
        expect(historyReads).toBe(1)
      } finally { process.env.NEDARIM_API_PASSWORD = "" }
    })

    it("recovers one existing payment and completes its order without creating another charge", async () => {
      const payment = await preparedCheckout()
      historyRows = [{ TransactionId: "100003", Comments: `Mechon ${payment.attemptId}`, Amount: "133.45", Currency: "1", Confirmation: "123456", Solek: "1" }]
      process.env.NEDARIM_API_PASSWORD = "npk_local_test_only"
      try {
        await recoverNedarimPayment({ container, args: [payment.attemptId, "100003"] } as any)
        await recoverNedarimPayment({ container, args: [payment.attemptId, "100003"] } as any)
        const attempt = await ledger.retrieveNedarimAttempt(payment.attemptId)
        expect(attempt.payment_id).toBe("100003")
        expect(attempt.processed_at).not.toBeNull()
        expect(historyReads).toBe(1)
        expect(upstreamRequests).toHaveLength(1)
        const { data: orders } = await container.resolve("query").graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: payment.cartId } })
        expect(orders).toHaveLength(1)
      } finally { process.env.NEDARIM_API_PASSWORD = "" }
    })
  },
})
