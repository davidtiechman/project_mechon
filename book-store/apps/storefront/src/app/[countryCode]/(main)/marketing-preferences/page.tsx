import { cookies } from "next/headers"
import { getMarketingPreference } from "@lib/data/marketing-consent"
import MarketingPreferences from "@modules/account/components/marketing-preferences"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { contactDetails } from "@lib/contact-details"

export const metadata = { title: "העדפות דיוור", robots: { index: false, follow: false }, referrer: "no-referrer" as const }
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams
  const preference = await getMarketingPreference().catch(() => null)
  const token = params.token || (!preference ? (await cookies()).get("_marketing_unsubscribe")?.value : undefined)
  return (
    <div dir="rtl" className="content-container max-w-3xl py-10">
      <h1 className="text-3xl mb-6">ניהול הסכמה לדיוור פרסומי</h1>
      {token || preference ? <MarketingPreferences token={token} subscribed={preference?.consent?.status === "subscribed"} /> : <p>
        לניהול ההעדפות ניתן <LocalizedClientLink className="underline" href="/account">להתחבר לחשבון</LocalizedClientLink>, להשתמש בקישור ההסרה האישי או לפנות אלינו ב<a className="underline" href={contactDetails.emailHref}>{contactDetails.email}</a>.
      </p>}
      <p className="mt-5">ההסכמה אינה תנאי לרכישה. ביטולה אינו משפיע על קבלת הודעות שירות הנדרשות לטיפול בהזמנה.</p>
    </div>
  )
}
