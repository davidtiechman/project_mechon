import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260809143806 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "site_content_site_setting" drop constraint if exists "site_content_site_setting_key_unique";`);
    this.addSql(`alter table if exists "site_content_page" drop constraint if exists "site_content_page_slug_unique";`);
    this.addSql(`alter table if exists "site_content_navigation_menu" drop constraint if exists "site_content_navigation_menu_handle_unique";`);
    this.addSql(`alter table if exists "site_content_brand" drop constraint if exists "site_content_brand_slug_unique";`);
    this.addSql(`alter table if exists "site_content_article" drop constraint if exists "site_content_article_slug_unique";`);
    this.addSql(`create table if not exists "site_content_article" ("id" text not null, "title" text not null, "slug" text not null, "excerpt" text null, "content" text null, "featured_image" text null, "image_alt" text null, "author" text null, "published_at" timestamptz null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "related_brand_ids" text[] not null default '{}', "related_article_ids" text[] not null default '{}', "seo" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_article_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_article_slug_unique" ON "site_content_article" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_article_deleted_at" ON "site_content_article" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_banner" ("id" text not null, "internal_name" text not null, "title" text null, "subtitle" text null, "desktop_image" text null, "mobile_image" text null, "image_alt" text null, "button_text" text null, "button_url" text null, "open_new_tab" boolean not null default false, "placement" text check ("placement" in ('homepage_top', 'homepage_middle', 'products', 'articles', 'global')) not null, "start_at" timestamptz null, "end_at" timestamptz null, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_banner_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_banner_deleted_at" ON "site_content_banner" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_brand" ("id" text not null, "name" text not null, "slug" text not null, "title" text null, "subtitle" text null, "short_description" text null, "content" text null, "logo" text null, "hero_image" text null, "mobile_image" text null, "image_alt" text null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "sort_order" integer not null default 0, "seo" jsonb null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_brand_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_brand_slug_unique" ON "site_content_brand" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_brand_deleted_at" ON "site_content_brand" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_faq_item" ("id" text not null, "question" text not null, "answer" text not null, "group" text null, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_faq_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_faq_item_deleted_at" ON "site_content_faq_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_footer_link" ("id" text not null, "section_id" text not null, "label" text not null, "url" text not null, "open_new_tab" boolean not null default false, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_footer_link_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_footer_link_deleted_at" ON "site_content_footer_link" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_footer_section" ("id" text not null, "title" text not null, "content" text null, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_footer_section_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_footer_section_deleted_at" ON "site_content_footer_section" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_navigation_item" ("id" text not null, "menu_id" text not null, "parent_id" text null, "label" text not null, "url" text not null, "open_new_tab" boolean not null default false, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_navigation_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_navigation_item_deleted_at" ON "site_content_navigation_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_navigation_menu" ("id" text not null, "name" text not null, "handle" text not null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_navigation_menu_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_navigation_menu_handle_unique" ON "site_content_navigation_menu" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_navigation_menu_deleted_at" ON "site_content_navigation_menu" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_page" ("id" text not null, "title" text not null, "slug" text not null, "excerpt" text null, "content" text null, "hero_image" text null, "mobile_image" text null, "image_alt" text null, "status" text check ("status" in ('draft', 'published', 'archived')) not null default 'draft', "sort_order" integer not null default 0, "seo" jsonb null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_page_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_page_slug_unique" ON "site_content_page" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_page_deleted_at" ON "site_content_page" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_section" ("id" text not null, "owner_type" text check ("owner_type" in ('home', 'page', 'brand')) not null, "owner_id" text not null, "type" text check ("type" in ('hero', 'text', 'image_text', 'banner', 'cta', 'products', 'brands', 'articles', 'gallery', 'faq')) not null, "internal_name" text not null, "title" text null, "subtitle" text null, "content" text null, "data" jsonb null, "active" boolean not null default true, "sort_order" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_section_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_section_deleted_at" ON "site_content_section" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "site_content_site_setting" ("id" text not null, "key" text not null, "value" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_site_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_site_setting_key_unique" ON "site_content_site_setting" ("key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_site_setting_deleted_at" ON "site_content_site_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_content_article" cascade;`);

    this.addSql(`drop table if exists "site_content_banner" cascade;`);

    this.addSql(`drop table if exists "site_content_brand" cascade;`);

    this.addSql(`drop table if exists "site_content_faq_item" cascade;`);

    this.addSql(`drop table if exists "site_content_footer_link" cascade;`);

    this.addSql(`drop table if exists "site_content_footer_section" cascade;`);

    this.addSql(`drop table if exists "site_content_navigation_item" cascade;`);

    this.addSql(`drop table if exists "site_content_navigation_menu" cascade;`);

    this.addSql(`drop table if exists "site_content_page" cascade;`);

    this.addSql(`drop table if exists "site_content_section" cascade;`);

    this.addSql(`drop table if exists "site_content_site_setting" cascade;`);
  }

}
