export type InstituteProject = {
  slug: string
  categoryHandle: string
  title: string
  description: string
}

/**
 * פרטי התצוגה והקישור לקטגוריית Medusa. שיוך הספרים עצמו מנוהל רק ב-Admin.
 */
export const instituteProjects: InstituteProject[] = [
  {
    slug: "avodat-hashem",
    categoryHandle: "עבודת-השם",
    title: "עבודת השם",
    description: "ספרים העוסקים בעבודת ה׳, בתפילה ובהדרכה מעשית לחיי תורה.",
  },
  {
    slug: "habina-vehabracha",
    categoryHandle: "הבינה-והברכה",
    title: "הבינה והברכה",
    description: "ספרי עיון והעמקה המבקשים לחבר בין בינה, אמונה וברכת התורה.",
  },
  {
    slug: "biurei-hachasidut",
    categoryHandle: "ביאורי-החסידות",
    title: "ביאורי החסידות",
    description: "ביאורים ומפתחות ללימוד תורת החסידות בעומק ובבהירות.",
  },
  {
    slug: "dibrot-kodesh",
    categoryHandle: "דברות-קודש",
    title: "דברות קודש",
    description: "שיחות, מאמרים ודברי תורה שנאמרו במועדי השנה ובהזדמנויות מיוחדות.",
  },
]

export const getInstituteProject = (slug: string) =>
  instituteProjects.find((project) => project.slug === slug)
