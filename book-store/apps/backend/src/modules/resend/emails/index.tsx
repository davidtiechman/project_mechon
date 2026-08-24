import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

type Address = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

type Item = {
  id?: string
  product_title?: string | null
  title?: string | null
  variant_title?: string | null
  quantity?: number
  total?: unknown
}

export type OrderEmailData = {
  display_id: string | number
  email?: string | null
  customer_name?: string
  phone?: string | null
  currency_code: string
  items?: Item[]
  shipping_address?: Address | null
  shipping_methods?: Array<{ name?: string; amount?: unknown }>
  shipping_total?: unknown
  total?: unknown
}

const styles = {
  body: { margin: 0, backgroundColor: "#f5f1e8", fontFamily: "Arial, sans-serif", direction: "rtl" as const },
  card: { maxWidth: "620px", margin: "24px auto", padding: "28px", backgroundColor: "#ffffff", borderRadius: "12px" },
  title: { color: "#49351f", fontSize: "25px", textAlign: "center" as const },
  text: { color: "#34291f", fontSize: "16px", lineHeight: "1.7", textAlign: "right" as const },
  muted: { color: "#766858", fontSize: "13px", lineHeight: "1.6", textAlign: "right" as const },
  row: { padding: "10px 0", borderBottom: "1px solid #eee7dc" },
  button: { backgroundColor: "#715330", color: "#ffffff", padding: "12px 22px", borderRadius: "6px", textDecoration: "none" },
}

function Layout({ preview, title, children }: { preview: string; title: string; children: ReactNode }) {
  return <Html lang="he" dir="rtl"><Head /><Preview>{preview}</Preview><Body style={styles.body}><Container style={styles.card}><Heading style={styles.title}>מכון מעשה רוקח</Heading><Heading as="h2" style={{ ...styles.title, fontSize: "21px" }}>{title}</Heading>{children}<Hr style={{ borderColor: "#ddd3c5", marginTop: "26px" }} /><Text style={styles.muted}>מכון מעשה רוקח</Text></Container></Body></Html>
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === "object") {
    const numeric = value as Record<string, unknown>

    // Medusa can expose monetary values and quantities as BigNumber-like
    // objects when they come from query.graph.
    for (const key of ["numeric_", "raw_", "value"]) {
      if (key in numeric && numeric[key] !== value) {
        const parsed = numberValue(numeric[key])
        if (parsed || numeric[key] === 0 || numeric[key] === "0") return parsed
      }
    }

    const primitive = value.valueOf()
    if (primitive !== value) return numberValue(primitive)

    const stringValue = value.toString()
    if (stringValue !== "[object Object]") return numberValue(stringValue)
  }
  return 0
}

function money(value: unknown, currency: string) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: currency.toUpperCase() }).format(numberValue(value))
}

function AddressBlock({ address }: { address?: Address | null }) {
  if (!address) return null
  const lines = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.address_1,
    address.address_2,
    [address.city, address.province, address.postal_code].filter(Boolean).join(", "),
    address.country_code?.toUpperCase(),
  ].filter(Boolean)
  return <Section><Heading as="h3" style={{ ...styles.title, fontSize: "17px", textAlign: "right" }}>כתובת משלוח</Heading>{lines.map((line) => <Text key={line} style={{ ...styles.text, margin: "2px 0" }}>{line}</Text>)}</Section>
}

function Items({ data }: { data: OrderEmailData }) {
  return <Section><Heading as="h3" style={{ ...styles.title, fontSize: "17px", textAlign: "right" }}>פרטי ההזמנה</Heading>{data.items?.map((item, index) => <Section key={item.id ?? index} style={styles.row}><Text style={{ ...styles.text, margin: 0 }}><strong>{item.product_title ?? item.title ?? "מוצר"}</strong>{item.variant_title ? ` — ${item.variant_title}` : ""}</Text><Text style={{ ...styles.muted, margin: "4px 0 0" }}>כמות: {numberValue(item.quantity)} · מחיר: {money(item.total, data.currency_code)}</Text></Section>)}</Section>
}

function Totals({ data }: { data: OrderEmailData }) {
  return <Section><Text style={styles.text}>משלוח: <strong>{money(data.shipping_total, data.currency_code)}</strong></Text><Text style={{ ...styles.text, fontSize: "19px" }}>סך הכול: <strong>{money(data.total, data.currency_code)}</strong></Text></Section>
}

export function OrderCustomerEmail(data: OrderEmailData) {
  return <Layout preview={`הזמנה #${data.display_id} התקבלה`} title={`הזמנה #${data.display_id} התקבלה בהצלחה`}><Text style={styles.text}>שלום {data.customer_name || "וברוכים הבאים"},</Text><Text style={styles.text}>תודה על הזמנתך. קיבלנו אותה בהצלחה ואנו מטפלים בה.</Text><Items data={data} /><Totals data={data} /><AddressBlock address={data.shipping_address} /><Text style={styles.text}>תודה שבחרת במכון מעשה רוקח.</Text></Layout>
}

export function OrderOwnerEmail(data: OrderEmailData) {
  const shipping = data.shipping_methods?.map((method) => method.name).filter(Boolean).join(", ")
  return <Layout preview={`התקבלה הזמנה חדשה #${data.display_id}`} title={`התקבלה הזמנה חדשה #${data.display_id}`}><Text style={styles.text}>שם: <strong>{data.customer_name || "לא נמסר"}</strong><br />אימייל: {data.email || "לא נמסר"}<br />טלפון: {data.phone || "לא נמסר"}<br />אמצעי משלוח: {shipping || "לא נמסר"}</Text><Items data={data} /><Totals data={data} /><AddressBlock address={data.shipping_address} /></Layout>
}

export function AdminPasswordResetEmail({ reset_url }: { reset_url: string }) {
  return <Layout preview="קישור לאיפוס הסיסמה" title="איפוס סיסמה"><Text style={styles.text}>התקבלה בקשה לאיפוס הסיסמה שלך במערכת הניהול.</Text><Section style={{ textAlign: "center", margin: "28px 0" }}><Button href={reset_url} style={styles.button}>איפוס סיסמה</Button></Section><Text style={styles.muted}>הקישור תקף לזמן מוגבל. אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל.</Text></Layout>
}

export function CustomerLoginCodeEmail({ code, expires_minutes }: { code: string; expires_minutes: number }) {
  return <Layout preview="קוד הכניסה שלך" title="קוד כניסה חד־פעמי"><Text style={styles.text}>קוד הכניסה שלך למכון מעשה רוקח:</Text><Text style={{ ...styles.title, fontSize: "34px", letterSpacing: "8px", direction: "ltr" }}><strong>{code}</strong></Text><Text style={styles.text}>הקוד תקף ל־{expires_minutes} דקות.</Text><Text style={styles.muted}>אם לא ביקשת קוד זה, ניתן להתעלם מהודעה זו. אין להעביר את הקוד לאדם אחר.</Text></Layout>
}

export function AdminInviteEmail({ invite_url }: { invite_url: string }) {
  return <Layout preview="הזמנה למערכת הניהול" title="הזמנה למערכת הניהול"><Text style={styles.text}>הוזמנת להצטרף למערכת הניהול של מכון מעשה רוקח.</Text><Section style={{ textAlign: "center", margin: "28px 0" }}><Button href={invite_url} style={styles.button}>קבלת ההזמנה</Button></Section><Text style={styles.muted}>הקישור מכיל את קוד ההזמנה המאובטח שיצרה המערכת ותקף לזמן מוגבל.</Text></Layout>
}
