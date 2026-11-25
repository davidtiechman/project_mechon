import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// Additive and nullable: the split Nedarim reports for installment payments (display only).
export class Migration20261126000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "nedarim_attempt" add column if not exists "first_installment_minor" integer null;`)
    this.addSql(`alter table if exists "nedarim_attempt" add column if not exists "next_installment_minor" integer null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "nedarim_attempt" drop column if exists "next_installment_minor";`)
    this.addSql(`alter table if exists "nedarim_attempt" drop column if exists "first_installment_minor";`)
  }
}
