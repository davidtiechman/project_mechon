"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@modules/common/components/ui"
import { beginNedarimPayment, getNedarimPaymentStatus, NedarimPayment, NedarimStatus } from "@lib/data/nedarim"
import { placeOrder } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import { installmentLabel } from "@lib/util/installments"
import ErrorMessage from "../error-message"
import PaymentProcessingOverlay from "./processing-overlay"

const ORIGIN = "https://www.matara.pro"
const IFRAME_URL = `${ORIGIN}/nedarimplus/iframe/v3/`
const POLL_MS = 3000
// Without any result from the payment window, close it after this long and verify.
export const OPEN_TIMEOUT_MS = 10 * 60_000
// After the window reports success, wait this many checks (~90s) for server confirmation.
const SUCCESS_CHECKS = 30
// After a decline or timeout, a few checks are enough: Nedarim answers "not executed" at once.
const FAILURE_CHECKS = 3
const DELAYED_POLL_MS = 30_000
const DELAYED_CHECKS = 30

type Phase = "idle" | "open" | "processing" | "completing" | "delayed"
type Reason = "success" | "declined" | "timeout" | "manual"

export const NEDARIM_TEXT = {
  processing: "מעבדים את העסקה…",
  preparing: "מכינים את התשלום…",
  completing: "התשלום אושר. משלימים את ההזמנה…",
  retry: "לתשלום חוזר",
  pay: "לתשלום",
  check: "בדיקת אישור התשלום",
  failed: {
    success: "העסקה לא אושרה ולא בוצע חיוב. אפשר לנסות שוב.",
    declined: "העסקה לא בוצעה ולא בוצע חיוב. אפשר לבדוק את פרטי התשלום ולנסות שוב.",
    timeout: "זמן התשלום הסתיים ולא בוצע חיוב. אפשר לנסות שוב.",
    manual: "התשלום לא בוצע ולא בוצע חיוב. אפשר לנסות שוב.",
  } as Record<Reason, string>,
  // Shown only when the server cannot get a reliable answer from Nedarim.
  delayed: "אישור התשלום מתעכב. אם התשלום בוצע, ההזמנה תאושר ותישלח אליך הודעה בדוא״ל בתוך כמה דקות. אין לשלם שוב.",
  paidOrderPending: "התשלום התקבל. ההזמנה תאושר ותישלח אליך הודעה בדוא״ל בתוך כמה דקות. אין לשלם שוב.",
  bitPending: "ממתינים לאישור התשלום באפליקציה.",
}

const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms) })

/**
 * The customer sees only three outcomes: processing, success, or "not completed — try again".
 * Every decision is made by our server: the browser's success message only triggers a
 * server check, and a failure is shown only when Nedarim itself reports "not executed".
 * If Nedarim cannot answer, the customer is told the confirmation is delayed — never that
 * the payment failed — so a payment that did go through is never repeated.
 */
export default function NedarimPaymentButton({ notReady, beforePayment, onSubmittingChange, checkoutPaused = false, formId, loadPayment = beginNedarimPayment, onPaymentStarted, onPaymentClosed }: {
  notReady: boolean
  beforePayment: () => Promise<boolean>
  onSubmittingChange: (submitting: boolean) => void
  checkoutPaused?: boolean
  formId?: string
  loadPayment?: () => Promise<NedarimStatus>
  onPaymentStarted?: () => void
  onPaymentClosed?: () => void
}) {
  const [payment, setPayment] = useState<NedarimPayment | null>(null)
  const [plan, setPlan] = useState<NedarimStatus["plan"] | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [retry, setRetry] = useState(false)
  const [paid, setPaid] = useState(false)
  const [activity, setActivity] = useState(0)
  const locked = useRef(false)
  const settling = useRef(false)
  const completing = useRef(false)
  // Each opened payment window gets a new generation; loops of a closed window stop.
  const generation = useRef(0)
  const phaseRef = useRef<Phase>("idle")
  const go = (next: Phase) => { phaseRef.current = next; setPhase(next) }
  // Parent callbacks change identity on every render; keep timers and loops stable.
  const parent = useRef({ onSubmittingChange, onPaymentClosed })
  parent.current = { onSubmittingChange, onPaymentClosed }

  const complete = useCallback(async () => {
    if (completing.current) return
    completing.current = true
    setPaid(true)
    go("completing")
    setError(null)
    setMessage("")
    try { await placeOrder() } catch { /* a background job completes paid orders */ }
    finally { completing.current = false }
    // A completed order navigates to its confirmation page. Still here: the payment is
    // recorded and the order is completed in the background and confirmed by email.
    go("delayed")
    setMessage(NEDARIM_TEXT.paidOrderPending)
  }, [])

  const fail = useCallback((reason: Reason) => {
    generation.current++
    setPayment(null)
    go("idle")
    setRetry(true)
    setMessage("")
    setError(NEDARIM_TEXT.failed[reason])
    parent.current.onSubmittingChange(false)
    parent.current.onPaymentClosed?.()
  }, [])

  const settle = useCallback(async (reason: Reason) => {
    if (settling.current || completing.current) return
    settling.current = true
    const run = generation.current
    go("processing")
    setError(null)
    setMessage("")
    let notPaid = false
    try {
      const checks = reason === "success" ? SUCCESS_CHECKS : FAILURE_CHECKS
      for (let i = 0; i < checks && run === generation.current; i++) {
        if (i) await sleep(POLL_MS)
        if (run !== generation.current) return
        let result: NedarimStatus | null = null
        try { result = await getNedarimPaymentStatus(true) } catch { result = null }
        if (run !== generation.current) return
        if (result?.status === "paid") { settling.current = false; await complete(); return }
        notPaid = result?.provider === "not_paid"
        // A decline or timeout is final once Nedarim says the transaction was not executed.
        // After a reported success, keep waiting: the callback may still be on its way.
        if (notPaid && reason !== "success") break
      }
      if (run !== generation.current) return
      if (notPaid) fail(reason)
      else { go("delayed"); setMessage(NEDARIM_TEXT.delayed) }
    } finally { settling.current = false }
  }, [complete, fail])

  // While the window is open: a cheap database poll catches the signed callback, and a
  // timeout closes an abandoned window after a server-side check.
  useEffect(() => {
    if (phase !== "open") return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const run = generation.current
    const poll = async () => {
      if (stopped) return
      try {
        if ((await getNedarimPaymentStatus()).status === "paid") {
          if (!stopped && run === generation.current) await complete()
          return
        }
      } catch { /* keep polling; nothing is decided in the browser */ }
      if (!stopped) timer = setTimeout(poll, POLL_MS)
    }
    timer = setTimeout(poll, POLL_MS)
    const timeout = setTimeout(() => { if (!stopped && phaseRef.current === "open") void settle("timeout") }, OPEN_TIMEOUT_MS)
    return () => { stopped = true; clearTimeout(timer); clearTimeout(timeout) }
  }, [phase, activity, complete, settle])

  // A delayed confirmation keeps checking with Nedarim in the background for a while.
  useEffect(() => {
    if (phase !== "delayed" || paid) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let count = 0
    const run = generation.current
    const poll = async () => {
      if (stopped || run !== generation.current) return
      try {
        const result = await getNedarimPaymentStatus(true)
        if (stopped || run !== generation.current) return
        if (result.status === "paid") return void complete()
        if (result.provider === "not_paid") return fail("manual")
      } catch { /* still unknown */ }
      if (!stopped && ++count < DELAYED_CHECKS) timer = setTimeout(poll, DELAYED_POLL_MS)
    }
    timer = setTimeout(poll, DELAYED_POLL_MS)
    return () => { stopped = true; clearTimeout(timer) }
  }, [phase, paid, complete, fail])

  const begin = async () => {
    if (locked.current || checkoutPaused || notReady) return
    locked.current = true
    setPreparing(true)
    onSubmittingChange(true)
    setError(null)
    setMessage("")
    try {
      if (!await beforePayment()) { onSubmittingChange(false); return }
      const result = await loadPayment()
      if (result.status === "paid") { onPaymentStarted?.(); await complete(); return }
      if (!result.payment) throw new Error(result.message || "לא ניתן לפתוח את התשלום.")
      // Reopening reuses the same server transaction: an unpaid Nedarim transaction has
      // no expiry and can be charged only once, so a retry can never charge twice.
      generation.current++
      setPayment(result.payment)
      setPlan(result.plan && result.plan.count > 1 ? result.plan : null)
      setRetry(false)
      go("open")
      setActivity(value => value + 1)
      onPaymentStarted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לפתוח את התשלום כרגע.")
      onSubmittingChange(false)
    } finally { locked.current = false; setPreparing(false) }
  }

  const checkAgain = () => { if (paid) void complete(); else void settle("manual") }

  const overlay = preparing ? NEDARIM_TEXT.preparing
    : phase === "processing" ? NEDARIM_TEXT.processing
    : phase === "completing" ? NEDARIM_TEXT.completing : null

  return <div className="w-full space-y-4">
    {overlay && <PaymentProcessingOverlay label={overlay} />}
    {checkoutPaused && <p role="status" className="rounded-md border border-[#ddcec0] bg-[#faf6f1] p-3 text-sm">פתיחת התשלום מושהית כרגע.</p>}
    <ErrorMessage error={error} data-testid="nedarim-payment-error" />
    {phase === "idle" && !paid && <Button type={formId ? "submit" : "button"} form={formId} size="large" className="w-full"
      disabled={notReady || preparing || checkoutPaused} isLoading={preparing} onClick={begin} data-testid="submit-order-button">
      {retry ? NEDARIM_TEXT.retry : NEDARIM_TEXT.pay}
    </Button>}
    {payment && plan && (phase === "open" || phase === "processing") && <p role="note" data-testid="installments-summary"
      className="rounded-md border border-[#ddcec0] bg-[#faf6f1] p-3 text-base font-semibold">
      {`תשלום ב־${installmentLabel(plan, amount => convertToLocale({ amount, currency_code: plan.currency_code }))}, בכרטיס אשראי`}
    </p>}
    {payment && (phase === "open" || phase === "processing") && <div inert={phase === "processing" ? true : undefined}>
      <NedarimFrame payment={payment}
        onResult={() => { void settle("success") }}
        onError={requiresInput => { if (!requiresInput) void settle("declined") }}
        onPending={() => { setMessage(NEDARIM_TEXT.bitPending); setActivity(value => value + 1) }}
        onBack={() => { setMessage(""); setActivity(value => value + 1) }}
        onCancel={() => { setMessage("") }} />
    </div>}
    {phase === "delayed" && <Button type="button" variant="secondary" onClick={checkAgain}>{NEDARIM_TEXT.check}</Button>}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
  </div>
}

function NedarimFrame({ payment, onResult, onError, onPending, onBack, onCancel }: {
  payment: NedarimPayment
  onResult: () => void
  onError: (requiresInput: boolean) => void
  onPending: () => void
  onBack: () => void
  onCancel: () => void
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const sent = useRef(false)
  const callbacks = useRef({ onResult, onError, onPending, onBack, onCancel })
  callbacks.current = { onResult, onError, onPending, onBack, onCancel }
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
          else if (event.data.Value?.Status === "Error") callbacks.current.onError(Boolean(event.data.Value.BackMessage))
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
    title="פרטי תשלום" scrolling="no" referrerPolicy="strict-origin-when-cross-origin"
    style={{ width: "100%", height, border: 0 }} data-testid="nedarim-iframe" />
}
