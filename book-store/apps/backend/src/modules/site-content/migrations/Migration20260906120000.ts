import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260906120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "site_content_advertisement" ("id" text not null, "internal_name" text not null, "title" text null, "body" text null, "desktop_image" text null, "mobile_image" text null, "image_alt" text null, "button_text" text null, "button_url" text null, "open_new_tab" boolean not null default false, "show_delay_seconds" integer not null default 0, "auto_close_seconds" integer not null default 6, "show_timer" boolean not null default true, "display_frequency" text check ("display_frequency" in ('always', 'once_session', 'once_ever')) not null default 'once_session', "start_at" timestamptz null, "end_at" timestamptz null, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_advertisement_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_advertisement_deleted_at" ON "site_content_advertisement" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`update "site_content_page" set "content" = coalesce("content", '') || '<h2>אחסון מקומי לצורך מודעות</h2><p>לצורך מניעת הצגה חוזרת של מודעות, האתר שומר בדפדפן סימון טכני ב־sessionStorage או ב־localStorage. הסימון אינו כולל שם, כתובת, פרטי קשר או מידע מזהה אחר, ואינו נשמר באמצעות Cookie.</p>', "updated_at" = now() where "slug" = 'privacy' and "deleted_at" is null and coalesce("content", '') not like '%אחסון מקומי לצורך מודעות%';`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_content_advertisement" cascade;`)
  }
}
