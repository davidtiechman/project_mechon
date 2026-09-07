import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260907110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`insert into "site_content_page" ("id", "title", "slug", "excerpt", "content", "status", "sort_order", "published_at", "created_at", "updated_at") select 'contact-page-default', 'צור קשר', 'contact', 'נשמח לקבל את פנייתכם.', '<h2>פרטי קשר</h2><p>מכון מעשה רוקח מופעל על ידי מעשה רוקח בע"מ · ח.פ. 514692946 · טלפון: <a href="tel:025386591">02-5386591</a> · פקס: 02-5386379 · דוא״ל: <a href="mailto:5386591@gmail.com">5386591@gmail.com</a> · דובר שלום 7 מיקוד: 9447607 ירושלים</p>', 'published', 5, now(), now(), now() where not exists (select 1 from "site_content_page" where "slug" = 'contact' and "deleted_at" is null);`)
  }

  override async down(): Promise<void> {
    this.addSql(`delete from "site_content_page" where "id" = 'contact-page-default';`)
  }
}
