import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260907100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`update "site_content_page" set "content" = replace(replace(replace(coalesce("content", ''), '[טלפון ואימייל]', 'טלפון: <a href="tel:025386591">02-5386591</a> · פקס: 02-5386379 · דוא״ל: <a href="mailto:5386591@gmail.com">5386591@gmail.com</a>'), '[טלפון]', 'טלפון: <a href="tel:025386591">02-5386591</a> · פקס: 02-5386379'), '[אימייל]', 'דוא״ל: <a href="mailto:5386591@gmail.com">5386591@gmail.com</a>'), "updated_at" = now() where "deleted_at" is null and (coalesce("content", '') like '%[טלפון]%' or coalesce("content", '') like '%[אימייל]%' or coalesce("content", '') like '%[טלפון ואימייל]%');`)
    this.addSql(`update "site_content_page" set "content" = replace(coalesce("content", ''), '[אימייל ופרטי קשר]', 'טלפון: <a href="tel:025386591">02-5386591</a> · פקס: 02-5386379 · דוא״ל: <a href="mailto:5386591@gmail.com">5386591@gmail.com</a>'), "updated_at" = now() where "deleted_at" is null and coalesce("content", '') like '%[אימייל ופרטי קשר]%';`)
    this.addSql(`update "site_content_page" set "content" = coalesce("content", '') || '<h2>פרטי התקשרות</h2><p>טלפון: <a href="tel:025386591">02-5386591</a> · פקס: 02-5386379 · דוא״ל: <a href="mailto:5386591@gmail.com">5386591@gmail.com</a></p>', "updated_at" = now() where "slug" = 'contact' and "deleted_at" is null and coalesce("content", '') not like '%02-5386591%';`)
  }

  override async down(): Promise<void> {
    // Contact details are intentionally not removed from managed content.
  }
}
