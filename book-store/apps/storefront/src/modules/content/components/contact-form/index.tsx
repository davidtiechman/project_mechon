"use client"

import Input from "@modules/common/components/input"
import { Button } from "@modules/common/components/ui"
import { FormEvent, useState } from "react"

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  )
  const [message, setMessage] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus("sending")
    setMessage("")
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok)
        throw new Error(result.message || "לא ניתן לשלוח את הפנייה כרגע")
      setStatus("sent")
      setMessage("הפנייה נשלחה בהצלחה. נחזור אליכם בהקדם.")
      form.reset()
    } catch (error) {
      setStatus("error")
      setMessage((error as Error).message)
    }
  }

  return (
    <section
      aria-labelledby="contact-form-title"
      className="content-container max-w-4xl pb-16"
    >
      <h2 id="contact-form-title" className="mb-6 text-2xl text-[#4a2d21]">
        שליחת פנייה
      </h2>
      <form onSubmit={submit} className="grid gap-4 small:grid-cols-2">
        <Input label="שם" name="name" autoComplete="name" required />
        <Input
          label="פלאפון"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          required
        />
        <Input
          label="מייל"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">אין למלא שדה זה</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="flex flex-col gap-2 small:col-span-2 text-ui-fg-subtle">
          פנייה{" "}
          <span aria-hidden="true" className="text-rose-600">
            *
          </span>
          <textarea
            name="inquiry"
            required
            rows={6}
            className="rounded-md border border-ui-border-base bg-ui-bg-field px-4 py-3 text-ui-fg-base focus:outline-none focus:shadow-borders-interactive-with-active"
          />
        </label>
        <div className="small:col-span-2">
          <Button type="submit" isLoading={status === "sending"}>
            שליחה
          </Button>
          {message && (
            <p
              role={status === "error" ? "alert" : "status"}
              className={`mt-3 text-sm ${status === "error" ? "text-rose-700" : "text-green-800"}`}
            >
              {message}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
