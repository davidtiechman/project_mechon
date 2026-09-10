import {
  isValidEmail,
  isValidIsraeliPhone,
} from "@lib/util/checkout-validation"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .refine((value) => !/[\r\n\0]/.test(value)),
  phone: z.string().trim().min(1).refine(isValidIsraeliPhone),
  email: z.string().trim().refine(isValidEmail),
  inquiry: z.string().trim().min(5).max(5000),
  website: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > 12_000)
    return NextResponse.json({ message: "הפנייה ארוכה מדי" }, { status: 413 })

  const parsed = schema.safeParse(
    (() => {
      try {
        return JSON.parse(rawBody)
      } catch {
        return null
      }
    })(),
  )
  if (!parsed.success)
    return NextResponse.json(
      { message: "יש לבדוק את פרטי הפנייה" },
      { status: 400 },
    )
  if (parsed.data.website)
    return NextResponse.json({ message: "הפנייה התקבלה" })

  const webhook = process.env.CONTACT_FORM_WEBHOOK_URL
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const to = process.env.CONTACT_FORM_TO_EMAIL
  if (!webhook && !(apiKey && from && to && isValidEmail(from) && isValidEmail(to)))
    return NextResponse.json(
      {
        message:
          "טופס יצירת הקשר טרם חובר. אפשר לפנות אלינו בפרטים המופיעים בעמוד.",
      },
      { status: 503 },
    )

  try {
    const { name, phone, email, inquiry } = parsed.data
    const response = await fetch(webhook || "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(!webhook ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(
        webhook
          ? { name, phone, email, inquiry, source: "website-contact-form" }
          : {
              from,
              to: [to],
              reply_to: email,
              subject: `פנייה חדשה מהאתר — ${name}`,
              text: `שם: ${name}\nטלפון: ${phone}\nאימייל: ${email}\n\n${inquiry}`,
            },
      ),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error("Contact delivery failed")
    if (!webhook) {
      const result = await response.json()
      if (typeof result?.id !== "string" || !result.id)
        throw new Error("Missing email receipt")
    }
  } catch {
    return NextResponse.json(
      { message: "לא ניתן לשלוח את הפנייה כרגע" },
      { status: 502 },
    )
  }
  return NextResponse.json({ message: "הפנייה נשלחה" })
}
