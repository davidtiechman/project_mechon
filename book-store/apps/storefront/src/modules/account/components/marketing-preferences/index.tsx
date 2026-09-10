"use client"

import { useState } from "react"
import { unsubscribeMarketing, updateMarketingPreference } from "@lib/data/marketing-consent"
import { MARKETING_CONSENT_VERSION } from "@lib/marketing-consent"
import MarketingCheckbox from "../marketing-checkbox"

export default function MarketingPreferences({ subscribed, token }: { subscribed?: boolean; token?: string }) {
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [current, setCurrent] = useState(subscribed)
  async function save(optIn: boolean) {
    setBusy(true)
    setMessage("")
    try {
      if (token) await unsubscribeMarketing(token)
      else await updateMarketingPreference(optIn, MARKETING_CONSENT_VERSION)
      setCurrent(optIn)
      setAccepted(false)
      setMessage(optIn ? "ההסכמה לדיוור נשמרה." : "ההסכמה לדיוור בוטלה. לא יישלחו אליך הודעות פרסומיות.")
    } catch {
      setMessage("לא ניתן לשמור את הבחירה כרגע. אפשר לנסות שוב או לפנות אלינו בדף צור קשר.")
    } finally { setBusy(false) }
  }
  return (
    <section className="rounded border border-[#ddcec0] p-5">
      <h2 className="text-2xl mb-3">העדפות דיוור</h2>
      {!token && <p>{current ? "קיימת הסכמה לדיוור פרסומי." : "אין הסכמה פעילה לדיוור פרסומי."}</p>}
      {!token && !current && <>
        <MarketingCheckbox checked={accepted} onChange={setAccepted} disabled={busy} />
        <button type="button" disabled={!accepted || busy} onClick={() => save(true)} className="rounded bg-[#4a2d21] px-4 py-2 text-white disabled:opacity-50">שמירת הסכמה לדיוור</button>
      </>}
      {(token || current) && <button type="button" disabled={busy} onClick={() => save(false)} className="mt-3 rounded border border-[#4a2d21] px-4 py-2 disabled:opacity-50">ביטול הסכמה לדיוור פרסומי</button>}
      {message && <p role="status" className="mt-3">{message}</p>}
    </section>
  )
}
