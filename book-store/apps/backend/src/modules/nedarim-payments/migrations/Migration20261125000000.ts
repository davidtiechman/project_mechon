import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// Additive: existing attempts are single payments. Older code ignores the column.
export class Migration20261125000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "nedarim_attempt" add column if not exists "installments" integer not null default 1;`)
    this.addSql(`alter table if exists "nedarim_attempt" drop constraint if exists "nedarim_attempt_installments_check";`)
    this.addSql(`alter table if exists "nedarim_attempt" add constraint "nedarim_attempt_installments_check" check ("installments" between 1 and 36);`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "nedarim_attempt" drop constraint if exists "nedarim_attempt_installments_check";`)
    this.addSql(`alter table if exists "nedarim_attempt" drop column if exists "installments";`)
  }
}
