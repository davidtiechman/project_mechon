"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@modules/common/components/ui"
import { beginNedarimPayment, getNedarimPaymentStatus, NedarimPayment } from "@lib/data/nedarim"
import { placeOrder } from "@lib/data/cart"
import ErrorMessage from "../error-message"

const ORIGIN = "https://www.matara.pro"
const IFRAME_URL = `${ORIGIN}/nedarimplus/iframe/v3/`

export default function NedarimPaymentButton({ notReady, beforePayment, onSubmittingChange, checkoutPaused = false }: {
  notReady: boolean
  beforePayment: () => Promise<boolean>
  onSubmittingChange: (submitting: boolean) => void
  checkoutPaused?: boolean
}) {
  const [payment, setPayment] = useState<NedarimPayment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState("")
  const locked = useRef(false)
  const completing = useRef(false)

  const complete = useCallback(async () => {
    if (completing.current) return
    completing.current = true
    setMessage("התשלום אושר. משלימים את ההזמנה…")
    try {
      await placeOrder()
      setError("התשלום אושר, אך ההזמנה טרם הושלמה. אין לשלם שוב. אפשר ללחוץ על בדיקת אישור התשלום.")
    } catch {
      setError("התשלום אושר. אם לא הועברת לאישור ההזמנה, אפשר לבדוק שוב. אין לבצע תשלום נוסף.")
    } finally { completing.current = false }
  }, [])

  const check = useCallback(async () => {
    if (completing.current) return false
    const result = await getNedarimPaymentStatus()
    if (result.status === "paid") {
      setError(null)
      await complete()
      return true
    }
    return false
  }, [complete])

  useEffect(() => {
    if (!payment) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    const poll = async () => {
      if (stopped) return
      try {
        if (await check()) return
      } catch {
        if (!stopped) setMessage("ממתינים לאישור התשלום. ניתן לבדוק שוב בעוד רגע; אין צורך לשלם שוב.")
      }
      if (stopped) return
      if (Date.now() - started < 10 * 60_000) timer = setTimeout(poll, 3000)
      else setMessage("האישור עדיין ממתין. אפשר לבדוק שוב בכפתור למטה. אם כבר אישרת תשלום, אין לשלם שוב.")
    }
    timer = setTimeout(poll, 1500)
    return () => { stopped = true; clearTimeout(timer) }
  }, [payment, check])

  const begin = async () => {
    if (locked.current || checkoutPaused) return
    locked.current = true
    setSubmitting(true)
    onSubmittingChange(true)
    setError(null)
    try {
      if (!await beforePayment()) { onSubmittingChange(false); return }
      const result = await beginNedarimPayment()
      if (result.status === "paid") { await complete(); return }
      if (!result.payment) throw new Error("לא ניתן לפתוח את התשלום.")
      setPayment(result.payment)
      setMessage("בחרו אמצעי תשלום בחלון המאובטח.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לפתוח את התשלום כרגע.")
      onSubmittingChange(false)
    } finally { locked.current = false; setSubmitting(false) }
  }

  return <div className="w-full space-y-4">
    {checkoutPaused && <p role="status" className="rounded-md border border-[#ddcec0] bg-[#faf6f1] p-3 text-sm">נדרים פלוס זמין לבחירה. פתיחת חלון התשלום מושהית עד להשלמת הגדרת קבלת אישור התשלום בסביבה זו.</p>}
    {!payment && <>
      <p className="text-sm text-ui-fg-subtle">תשלום מאובטח בכרטיס אשראי, Google Pay, Apple Pay או bit, בהתאם למכשיר ולזמינות השירות.</p>
      <Button size="large" disabled={notReady || submitting || checkoutPaused} isLoading={submitting} onClick={begin} data-testid="submit-order-button">
        המשך לתשלום מאובטח
      </Button>
    </>}
    {payment && <>
      <NedarimFrame payment={payment} onResult={() => {
        setMessage("בודקים את אישור התשלום…")
        void check().catch(() => setMessage("ממתינים לאישור התשלום בשרת. אין לבצע תשלום נוסף."))
      }} onPending={() => setMessage("ממתינים לאישור באפליקציה. אפשר לחזור לכאן לאחר האישור.")}
        onBack={() => setMessage("אפשר לבחור אמצעי תשלום ולנסות שוב באותו חלון. אם כבר אישרת תשלום, בדקו את האישור לפני ניסיון נוסף.")}
        onCancel={() => setMessage("חלון הארנק נסגר. אפשר לבחור אמצעי תשלום בחלון המאובטח.")} />
      <Button variant="secondary" isLoading={checking} disabled={checking} onClick={async () => {
        setChecking(true)
        setError(null)
        try { if (!await check()) setMessage("אישור התשלום עדיין לא התקבל. אם כבר שילמת, אין לבצע תשלום נוסף.") }
        catch (err) { setError(err instanceof Error ? err.message : "לא ניתן לבדוק כרגע.") }
        finally { setChecking(false) }
      }}>בדיקת אישור התשלום</Button>
    </>}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    <ErrorMessage error={error} data-testid="nedarim-payment-error" />
  </div>
}

function NedarimFrame({ payment, onResult, onPending, onBack, onCancel }: {
  payment: NedarimPayment
  onResult: () => void
  onPending: () => void
  onBack: () => void
  onCancel: () => void
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const sent = useRef(false)
  const callbacks = useRef({ onResult, onPending, onBack, onCancel })
  callbacks.current = { onResult, onPending, onBack, onCancel }
  const [height, setHeight] = useState(520)
  const start = useCallback(() => {
    if (sent.current || !iframe.current?.contentWindow) return
    sent.current = true
    iframe.current.contentWindow.postMessage({ Name: "StartPayment", Value: payment }, ORIGIN)
  }, [payment])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== ORIGIN || event.source !== iframe.current?.contentWindow ||
          !event.data || typeof event.data !== "object") return
      switch (event.data.Name) {
        case "Ready": start(); break
        case "Height": {
          const value = Number(event.data.Value)
          if (Number.isFinite(value) && value > 0) setHeight(Math.min(2000, Math.max(200, value)))
          break
        }
        case "TransactionResponse":
          // This message can only prompt a server status check. It never authorizes an order.
          if (event.data.Value?.Status === "OK") callbacks.current.onResult()
          break
        case "PendingTransaction": callbacks.current.onPending(); break
        case "WalletCanceled": callbacks.current.onCancel(); break
        case "Back":
          callbacks.current.onBack()
          // Resume the same single-use transaction; never create a second payable transaction.
          sent.current = false
          start()
          break
      }
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [start])

  return <iframe ref={iframe} src={IFRAME_URL} onLoad={start} allow="payment"
    title="תשלום מאובטח בנדרים פלוס" scrolling="no" referrerPolicy="strict-origin-when-cross-origin"
    style={{ width: "100%", height, border: 0 }} data-testid="nedarim-iframe" />
}
