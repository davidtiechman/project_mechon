import { Context, InferTypeOf } from "@medusajs/framework/types"
import { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { NedarimAttemptModel } from "./models/nedarim-attempt"
import { NedarimSync } from "./models/nedarim-sync"

export type Attempt = InferTypeOf<typeof NedarimAttemptModel>

export default class NedarimPaymentsService extends MedusaService({ NedarimAttempt: NedarimAttemptModel, NedarimSync }) {
  // Database compare-and-set operations also protect against concurrent webhooks/replicas.
  @InjectManager()
  async claimCreation(id: string, cartId: string, @MedusaContext() context: Context<EntityManager> = {}) {
    const rows = await context.manager!.getKnex()("nedarim_attempt")
      .where({ id, transaction_id: null, paid_at: null, canceled_at: null, deleted_at: null })
      .where((q) => q.whereNull("creation_started_at").orWhere("creation_started_at", "<", new Date(Date.now() - 60_000)))
      .update({ cart_id: cartId, creation_started_at: new Date(), updated_at: new Date() }).returning("creation_started_at")
    return rows[0]?.creation_started_at as Date | undefined
  }

  @InjectManager()
  async finishCreation(id: string, startedAt: Date, transaction: { transaction_id: string; transaction_key: string }, @MedusaContext() context: Context<EntityManager> = {}) {
    const rows = await context.manager!.getKnex()("nedarim_attempt")
      .where({ id, creation_started_at: startedAt, transaction_id: null, canceled_at: null, deleted_at: null })
      .update({ ...transaction, updated_at: new Date() }).returning("id")
    // A delayed request that lost its lease must never expose its obsolete Key to a browser.
    return rows.length === 1
  }

  @InjectManager()
  async deferCompletion(id: string, @MedusaContext() context: Context<EntityManager> = {}) {
    await context.manager!.getKnex()("nedarim_attempt").where({ id, processed_at: null, deleted_at: null })
      .update({ updated_at: new Date() })
  }

  @InjectManager()
  async recordPayment(id: string, paymentId: string, method: string, @MedusaContext() context: Context<EntityManager> = {}) {
    const rows = await context.manager!.getKnex()("nedarim_attempt")
      .where({ id, payment_id: null, deleted_at: null })
      .update({ payment_id: paymentId, payment_method: method, paid_at: new Date(), updated_at: new Date() }).returning("id")
    if (rows.length) return
    const attempt = await this.retrieveNedarimAttempt(id)
    if (attempt.payment_id !== paymentId) throw new Error("Conflicting Nedarim payment")
  }

  @InjectManager()
  async claimSync(mosad: string, @MedusaContext() context: Context<EntityManager> = {}) {
    const knex = context.manager!.getKnex()
    await knex("nedarim_sync").insert({ id: mosad, last_id: "0", next_run_at: new Date(0) }).onConflict("id").ignore()
    const rows = await knex("nedarim_sync").where({ id: mosad }).where("next_run_at", "<=", new Date())
      .update({ next_run_at: new Date(Date.now() + 10 * 60_000), updated_at: new Date() }).returning("last_id")
    return rows[0]?.last_id as string | undefined
  }
}
