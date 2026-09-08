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

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/contact`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!response.ok) {
      return NextResponse.json(
        { message: "לא ניתן לשלוח את הפנייה כרגע. אפשר לפנות בפרטים המופיעים בעמוד." },
        { status: 502 },
      )
    }
    return NextResponse.json({ message: "הפנייה נשלחה" })
  } catch {
    return NextResponse.json(
      { message: "לא ניתן לשלוח את הפנייה כרגע. נסו שוב מאוחר יותר." },
      { status: 502 },
    )
  }
}
