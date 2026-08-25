import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260825090000 extends Migration {
  override async up(): Promise<void> {
    const mistakenBrandName = "מעשה רוקח בע\"מ"
    const brandName = "מכון מעשה רוקח"

    for (const [table, columns] of [
      ["site_content_section", ["title", "subtitle", "content"]],
      ["site_content_page", ["title", "excerpt", "image_alt"]],
      ["site_content_brand", ["name", "title", "subtitle", "short_description", "content", "image_alt"]],
      ["site_content_article", ["title", "excerpt", "content", "image_alt"]],
      ["site_content_banner", ["internal_name", "title", "subtitle", "image_alt"]],
      ["site_content_footer_section", ["title"]],
      ["site_content_navigation_menu", ["name"]],
      ["site_content_navigation_item", ["label"]],
    ] as const) {
      for (const column of columns) {
        this.addSql(
          `update "${table}" set "${column}" = replace("${column}", '${mistakenBrandName}', '${brandName}'), "updated_at" = now() where "${column}" like '%${mistakenBrandName}%' and "deleted_at" is null;`
        )
      }
    }

    this.addSql(
      `update "site_content_site_setting" set "value" = replace("value"::text, '${mistakenBrandName}', '${brandName}')::jsonb, "updated_at" = now() where "value"::text like '%${mistakenBrandName}%' and "deleted_at" is null;`
    )

    this.addSql(
      `update "site_content_page" set "content" = '<p>מכון מעשה רוקח מופעל על ידי מעשה רוקח בע"מ · ח.פ. 514692946 · [טלפון] · [אימייל] · דובר שלום 7, מיקוד: 9447607, ירושלים</p>', "updated_at" = now() where "slug" = 'contact' and ("content" = '<p>[יש להשלים את פרטי הגוף המפעיל]</p>' or "content" = '<p>מעשה רוקח בע"מ · [טלפון] · [אימייל] · דובר שלום 7, מיקוד: 9447607, ירושלים</p>') and "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    // Company identity changes are intentionally not reverted.
  }
}
