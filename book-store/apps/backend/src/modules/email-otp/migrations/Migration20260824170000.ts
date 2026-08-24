import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260824170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "email_otp_challenge" ("id" text not null, "email" text not null, "auth_identity_id" text not null, "code_hash" text not null, "ip_hash" text not null, "expires_at" timestamptz not null, "attempt_count" integer not null default 0, "consumed_at" timestamptz null, "invalidated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_otp_challenge_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "IDX_email_otp_email" on "email_otp_challenge" ("email") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_email_otp_auth_identity" on "email_otp_challenge" ("auth_identity_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_email_otp_expires_at" on "email_otp_challenge" ("expires_at") where "deleted_at" is null;`)
    this.addSql(`create table if not exists "email_otp_rate_limit" ("id" text not null, "key_hash" text not null, "window_started_at" timestamptz not null, "request_count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_otp_rate_limit_pkey" primary key ("id"));`)
    this.addSql(`create unique index if not exists "IDX_email_otp_rate_key" on "email_otp_rate_limit" ("key_hash") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_otp_rate_limit" cascade;`)
    this.addSql(`drop table if exists "email_otp_challenge" cascade;`)
  }
}
