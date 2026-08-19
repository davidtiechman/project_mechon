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
  if (!webhook)
    return NextResponse.json(
      {
        message:
          "טופס יצירת הקשר טרם חובר. אפשר לפנות אלינו בפרטים המופיעים בעמוד.",
      },
      { status: 503 },
    )

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...parsed.data,
      website: undefined,
      source: "website-contact-form",
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok)
    return NextResponse.json(
      { message: "לא ניתן לשלוח את הפנייה כרגע" },
      { status: 502 },
    )
  return NextResponse.json({ message: "הפנייה נשלחה" })
}
