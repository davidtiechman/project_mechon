import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Resend } from "resend"
import { z } from "zod"

const schema = z.object({
  name: z.string().trim().min(2).max(100).refine((value) => !/[\r\n\0]/.test(value)),
  phone: z.string().trim().min(1).max(30).regex(/^[+\d\s()-]+$/),
  email: z.email().max(320),
  inquiry: z.string().trim().min(5).max(5000),
  website: z.string().max(200).optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "יש לבדוק את פרטי הפנייה" })
  }
  if (parsed.data.website) return res.json({ message: "הפנייה התקבלה" })

  const recipient = process.env.CONTACT_EMAIL
  const recipient = process.env.CONTACT_FORM_TO_EMAIL || process.env.CONTACT_EMAIL
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!recipient || !apiKey || !from) {
    return res.status(503).json({ message: "שירות הפניות אינו מוגדר" })
  }

  const { name, phone, email, inquiry } = parsed.data
  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from: `${process.env.RESEND_FROM_NAME || "מכון מעשה רוקח"} <${from}>`,
      to: [recipient],
      replyTo: email,
      subject: "פנייה חדשה מטופס צור קשר",
      text: `שם: ${name}\nטלפון: ${phone}\nמייל: ${email}\n\nתוכן הפנייה:\n${inquiry}`,
    })
    if (error || !data?.id) throw new Error("Contact email delivery failed")
    return res.json({ message: "הפנייה נשלחה" })
  } catch {
    req.scope.resolve("logger").error("Contact email delivery failed")
    return res.status(502).json({ message: "לא ניתן לשלוח את הפנייה כרגע" })
  }
}
