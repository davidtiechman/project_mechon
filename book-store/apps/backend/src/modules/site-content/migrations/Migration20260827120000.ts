import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260827120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "site_content_catalog" ("id" text not null, "file_key" text not null, "file_url" text not null, "file_name" text not null, "mime_type" text not null default 'application/pdf', "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_catalog_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_catalog_deleted_at" ON "site_content_catalog" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_catalog_single_active" ON "site_content_catalog" ("active") WHERE active = true AND deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_content_catalog" cascade;`)
  }
}
