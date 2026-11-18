import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261118000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "nedarim_attempt" ("id" text primary key, "session_id" text not null, "cart_id" text null, "amount_minor" integer not null check ("amount_minor" > 0), "currency_code" text not null, "transaction_id" text null, "transaction_key" text null, "payment_id" text null, "payment_method" text null, "creation_started_at" timestamptz null, "paid_at" timestamptz null, "canceled_at" timestamptz null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`)
    this.addSql(`create index if not exists "IDX_nedarim_session" on "nedarim_attempt" ("session_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_nedarim_cart" on "nedarim_attempt" ("cart_id") where "deleted_at" is null;`)
    // Never permit the same provider payment to fund two orders, including soft-deleted attempts.
    this.addSql(`create unique index if not exists "IDX_nedarim_payment_unique" on "nedarim_attempt" ("payment_id") where "payment_id" is not null;`)
    this.addSql(`create table if not exists "nedarim_sync" ("id" text primary key, "last_id" text not null default '0', "next_run_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null);`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "nedarim_sync";`)
    this.addSql(`drop table if exists "nedarim_attempt";`)
  }
}
