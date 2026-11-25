import { randomUUID } from "node:crypto"
import { AbstractPaymentProvider, MedusaError, PaymentSessionStatus } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput, CapturePaymentInput, DeletePaymentInput, GetPaymentStatusInput,
  InitiatePaymentInput, RetrievePaymentInput, UpdatePaymentInput,
} from "@medusajs/framework/types"
import NedarimPaymentsService from "../nedarim-payments/service"
import { checkNedarimTransaction, minorAmount, nedarimCurrency } from "../../lib/nedarim"

export default class NedarimPaymentProvider extends AbstractPaymentProvider {
  static identifier = "nedarim"
  private ledger: NedarimPaymentsService

  constructor(container: Record<string, any>, options: Record<string, unknown>) {
    super(container, options)
    this.ledger = container.nedarimPayments
  }

  async initiatePayment(input: InitiatePaymentInput) {
    // Only Medusa's context is authoritative. Ignore all caller-provided provider data.
    const sessionId = input.context?.idempotency_key
    if (!sessionId) throw new Error("Missing trusted payment session")
    nedarimCurrency(input.currency_code)
    const attempt = await this.ledger.createNedarimAttempts({
      id: `ndp_${randomUUID().replaceAll("-", "")}`, session_id: sessionId,
      amount_minor: minorAmount(input.amount), currency_code: input.currency_code.toLowerCase(),
    })
    return { id: attempt.id, data: { attempt_id: attempt.id }, status: PaymentSessionStatus.PENDING }
  }

  private async attempt(data: Record<string, unknown> | undefined, sessionId?: string) {
    if (typeof data?.attempt_id !== "string") throw new Error("Missing Nedarim payment attempt")
    const attempt = await this.ledger.retrieveNedarimAttempt(data.attempt_id)
    if (sessionId && attempt.session_id !== sessionId) throw new Error("Nedarim payment belongs to a different session")
    return attempt
  }

  // A callback can arrive after the customer already changed the cart. Replacing a
  // transaction that Nedarim reports as paid would strand that payment without an
  // order, so refuse; the callback or reconciliation then completes the original order.
  // If Nedarim cannot be reached, the existing safeguards still apply: a payment for a
  // replaced attempt is recorded and logged for manual reconciliation.
  private async assertNotPaidAtNedarim(attempt: { transaction_id?: string | null }) {
    if (!attempt.transaction_id) return
    let state
    try { state = await checkNedarimTransaction(attempt.transaction_id) } catch { return }
    if (state.state === "paid") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "התשלום כבר בוצע בנדרים פלוס ואישור ההזמנה בדרך. אין לשנות את העגלה ואין לשלם שוב.")
    }
  }

  async authorizePayment(input: AuthorizePaymentInput) {
    if (!input.context?.idempotency_key) throw new Error("Missing trusted payment session")
    const attempt = await this.attempt(input.data, input.context.idempotency_key)
    if (!attempt.paid_at || !attempt.payment_id || attempt.canceled_at) {
      // Never return pending_authorization: that would let Medusa create an unpaid order.
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "התשלום עדיין לא אושר בשרת.")
    }
    return { status: PaymentSessionStatus.CAPTURED, data: { attempt_id: attempt.id, transaction_id: attempt.payment_id } }
  }

  async getPaymentStatus(input: GetPaymentStatusInput) {
    const attempt = await this.attempt(input.data)
    return { status: attempt.paid_at && !attempt.canceled_at ? PaymentSessionStatus.CAPTURED : PaymentSessionStatus.PENDING }
  }

  async updatePayment(input: UpdatePaymentInput) {
    const attempt = await this.attempt(input.data)
    const amount = minorAmount(input.amount)
    if (amount === Number(attempt.amount_minor) && input.currency_code.toLowerCase() === attempt.currency_code) {
      return { data: { attempt_id: attempt.id } }
    }
    if (attempt.paid_at) throw new Error("Cannot change an already paid Nedarim session")
    await this.assertNotPaidAtNedarim(attempt)
    await this.ledger.updateNedarimAttempts({ id: attempt.id, canceled_at: new Date() })
    return this.initiatePayment({ ...input, context: { idempotency_key: attempt.session_id } })
  }

  async deletePayment(input: DeletePaymentInput) {
    const attempt = await this.attempt(input.data)
    if (attempt.paid_at) throw new Error("Cannot delete a paid Nedarim session")
    await this.assertNotPaidAtNedarim(attempt)
    await this.ledger.updateNedarimAttempts({ id: attempt.id, canceled_at: new Date() })
    return { data: { attempt_id: attempt.id } }
  }

  async retrievePayment(input: RetrievePaymentInput) {
    const attempt = await this.attempt(input.data)
    return { data: { attempt_id: attempt.id, transaction_id: attempt.payment_id } }
  }

  async capturePayment(input: CapturePaymentInput) {
    const attempt = await this.attempt(input.data)
    if (!attempt.paid_at || attempt.canceled_at) throw new Error("Nedarim payment is not confirmed")
    // The iframe already charged the full amount. Never charge again here.
    return { data: { attempt_id: attempt.id, transaction_id: attempt.payment_id } }
  }

  async cancelPayment(): Promise<never> {
    throw new Error("התשלום בנדרים כבר נסלק. ביטול כספי דורש ביטול או זיכוי בנדרים פלוס ואימות נפרד.")
  }

  async refundPayment(): Promise<never> {
    throw new Error("יש לבצע ולאמת את הזיכוי בנדרים פלוס. המערכת אינה מסמנת זיכוי שלא בוצע אצל הסולק.")
  }

  async getWebhookActionAndData() {
    // Only our authenticated, durable callback route is allowed to record payment facts.
    return { action: "not_supported" as const }
  }
}
