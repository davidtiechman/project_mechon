import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { SITE_CONTENT_MODULE } from "../modules/site-content";

const brands = [
  {
    name: "עבודת השם",
    slug: "avodat-hashem",
    short_description:
      "ספרים העוסקים בעבודת ה׳, בתפילה ובהדרכה מעשית לחיי תורה.",
  },
  {
    name: "הבינה והברכה",
    slug: "habina-vehabracha",
    short_description:
      "ספרי עיון והעמקה המבקשים לחבר בין בינה, אמונה וברכת התורה.",
  },
  {
    name: "ביאורי החסידות",
    slug: "biurei-hachasidut",
    short_description: "ביאורים ומפתחות ללימוד תורת החסידות בעומק ובבהירות.",
  },
  {
    name: "דברות קודש",
    slug: "dibrot-kodesh",
    short_description:
      "שיחות, מאמרים ודברי תורה שנאמרו במועדי השנה ובהזדמנויות מיוחדות.",
  },
];

const legalPages = [
  ["terms", "תקנון ותנאי רכישה", "[יש להחליף בתוכן משפטי מאושר]"],
  ["privacy", "מדיניות פרטיות", "[יש להחליף במדיניות פרטיות מאושרת]"],
  [
    "cancellations",
    "ביטולים והחזרות",
    "[יש להחליף במדיניות ביטולים והחזרות מאושרת]",
  ],
  [
    "shipping",
    "משלוחים ואיסוף עצמי",
    "[יש להשלים מחירים, זמנים ופרטי איסוף עצמי]",
  ],
  [
    "accessibility",
    "הצהרת נגישות",
    "[יש להשלים לאחר בדיקת נגישות ידנית ואישור מתאים]",
  ],
  [
    "contact",
    "צור קשר",
    'מכון מעשה רוקח מופעל על ידי מעשה רוקח בע"מ · ח.פ. 514692946 · [טלפון] · [אימייל] · דובר שלום 7 מיקוד: 9447607 ירושלים',
  ],
] as const;

export default async function seedSiteContent({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve(SITE_CONTENT_MODULE) as any;

  for (const [sort_order, brand] of brands.entries()) {
    const existing = await service.listBrands(
      { slug: brand.slug },
      { take: 1 },
    );
    if (!existing.length)
      await service.createBrands({
        ...brand,
        title: brand.name,
        status: "draft",
        published_at: null,
        sort_order,
      });
  }

  for (const [sort_order, [slug, title, placeholder]] of legalPages.entries()) {
    const existing = await service.listContentPages({ slug }, { take: 1 });
    if (!existing.length)
      await service.createContentPages({
        slug,
        title,
        excerpt: "תוכן זמני להשלמה ואישור",
        content: `<p>${placeholder}</p>`,
        status: "published",
        published_at: new Date(),
        sort_order,
      });
  }

  const hero = await service.listContentSections(
    { owner_type: "home", owner_id: "home", type: "hero" },
    { take: 1 },
  );
  if (!hero.length)
    await service.createContentSections({
      owner_type: "home",
      owner_id: "home",
      type: "hero",
      internal_name: "Homepage hero",
      active: true,
      sort_order: 0,
      title: "מכון מעשה רוקח",
      subtitle: "מכון להוצאת והאדרת תורת רבותינו זיע״א",
      content: "מהדירים את תורות רבותינו מבעלזא, יצירת פאר של סידור עבודת השם",
      data: {
        button_text: "לחנות הספרים",
        button_url: "/store",
        desktop_image: "/images/institute-emblem-open-left.png",
      },
    });

  const seo = await service.listSiteSettings({ key: "seo" }, { take: 1 });
  if (!seo.length)
    await service.createSiteSettings({
      key: "seo",
      value: {
        site_name: "מכון מעשה רוקח",
        default_title: "מכון מעשה רוקח",
        default_description:
          "ספרי קודש, סידורים, תהילים והוצאה לאור מבית מכון מעשה רוקח",
      },
    });
  logger.info("Site content seed completed");
}
