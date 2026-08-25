import type { ContentItem } from "@lib/data/site-content"

export const legalPages: Record<string, ContentItem> = {
  terms: {
    id: "fallback-terms",
    slug: "terms",
    status: "draft",
    title: "תקנון ותנאי רכישה",
    excerpt: "נוסח זמני להשלמה ולאישור של ייעוץ משפטי.",
    content: `<h2>כללי</h2><p>[יש להוסיף את הנוסח המשפטי המאושר]</p><h2>ביצוע רכישה</h2><p>[יש להשלים תנאי הזמנה, תשלום ואספקה]</p><h2>פרטי הגוף המפעיל</h2><p>מעשה רוקח בע"מ · ח.פ. 514692946 · דובר שלום 7, מיקוד: 9447607, ירושלים</p>`,
  },
  privacy: {
    id: "fallback-privacy",
    slug: "privacy",
    status: "draft",
    title: "מדיניות פרטיות",
    excerpt: "נוסח זמני להשלמה ולאישור של ייעוץ משפטי.",
    content: `<h2>המידע שנאסף</h2><p>[יש לפרט את סוגי המידע ומטרות השימוש]</p><h2>שמירה ושיתוף מידע</h2><p>[יש להשלים ספקים, תקופות שמירה וזכויות משתמשים]</p><h2>יצירת קשר בנושא פרטיות</h2><p>[אימייל ופרטי קשר]</p>`,
  },
  cancellations: {
    id: "fallback-cancellations",
    slug: "cancellations",
    status: "draft",
    title: "ביטולים והחזרות",
    excerpt: "נוסח זמני להשלמה ולאישור של ייעוץ משפטי.",
    content: `<h2>ביטול עסקה</h2><p>[יש להוסיף מדיניות ביטולים מאושרת]</p><h2>החזרת מוצרים</h2><p>[יש להשלים מועדים, תנאים ועלויות]</p><h2>יצירת קשר לביטול</h2><p>[טלפון ואימייל]</p>`,
  },
  shipping: {
    id: "fallback-shipping",
    slug: "shipping",
    status: "draft",
    title: "משלוחים ואיסוף עצמי",
    excerpt: "פרטי המשלוח והאיסוף יושלמו לאחר אישור תפעולי.",
    content: `<h2>משלוחים</h2><p>[מחיר משלוח] · [זמני אספקה] · [חברת שילוח]</p><h2>איסוף עצמי</h2><p>[כתובת האיסוף] · [ימים ושעות] · [תיאום נדרש]</p>`,
  },
  accessibility: {
    id: "fallback-accessibility",
    slug: "accessibility",
    status: "draft",
    title: "הצהרת נגישות",
    excerpt: "טיוטה טכנית להשלמה לאחר בדיקת נגישות ידנית וייעוץ מתאים.",
    content: `<h2>התאמות נגישות</h2><p>[יש לפרט התאמות, תקן ורמת נגישות רק לאחר בדיקה ואישור]</p><h2>הסדרי נגישות פיזיים</h2><p>[יש להשלים]</p><h2>יצירת קשר בנושא נגישות</h2><p>[שם איש קשר] · [טלפון] · [אימייל]</p><p>אם נתקלתם בקושי בשימוש באתר, נשמח לקבל פנייה ולפעול לשיפור.</p>`,
  },
  contact: {
    id: "fallback-contact",
    slug: "contact",
    status: "draft",
    title: "צור קשר",
    excerpt: "נשמח לקבל את פנייתכם.",
    content: `<h2>פרטי קשר</h2><p>מכון מעשה רוקח מופעל על ידי מעשה רוקח בע"מ · ח.פ. 514692946 · [טלפון] · [אימייל] · דובר שלום 7, מיקוד: 9447607, ירושלים</p>`,
  },
}

export const legalPageSlugs = Object.keys(legalPages)
