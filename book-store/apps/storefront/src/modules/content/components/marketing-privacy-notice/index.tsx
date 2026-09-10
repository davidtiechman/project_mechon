import { contactDetails } from "@lib/contact-details"
import Link from "next/link"

export default function MarketingPrivacyNotice() {
  return (
    <section id="marketing-privacy" dir="rtl" className="content-container max-w-4xl pb-10 text-right text-lg leading-8">
      <h2 className="mb-4 text-2xl">דיוור פרסומי והעדפות קשר</h2>
      <p>אם יופעל בעתיד דיוור פרסומי, מכון מעשה רוקח ישלח עדכונים, מבצעים והטבות בדוא״ל ו/או באמצעי הקשר שנמסרו רק למי שנתן הסכמה מפורשת ונפרדת לכך. ההצטרפות היא לבחירתך ואינה תנאי לרכישה או לפתיחת חשבון. אי־סימון התיבה אינו מהווה הסכמה.</p>
      <p className="mt-3">לצורך ניהול ההעדפות ותיעודן נשמור את סטטוס ההסכמה, מועד קבלתה, המקור שבו ניתנה, גרסת נוסח ההסכמה, פרטי הקשר שנכללו בה ומועד ביטולה, אם בוטלה. ההעדפה העדכנית תישמר ברשומת הלקוח ובחירה שנמסרה בקופה תתועד גם בהזמנה.</p>
      <p className="mt-3">ניתן לבטל את ההסכמה בכל עת, ללא עלות, דרך <Link className="underline" href="/il/marketing-preferences">העדפות הדיוור</Link>, בקישור ההסרה האישי שיצורף לדיוור אם יופעל, או בפנייה אל <a className="underline" href={contactDetails.emailHref}>{contactDetails.email}</a>. לאחר ביטול ההסכמה לא נשלח הודעות פרסומיות, אלא אם תינתן הסכמה מפורשת חדשה. הודעות שירות הנדרשות לטיפול בחשבון ובהזמנות אינן תלויות בהסכמה לדיוור פרסומי.</p>
    </section>
  )
}
