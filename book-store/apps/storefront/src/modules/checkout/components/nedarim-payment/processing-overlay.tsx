"use client"

import { useEffect, useRef } from "react"

export default function PaymentProcessingOverlay({ label }: { label: string }) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // A modal dialog makes the rest of the page inert, including keyboard navigation
    // and the payment iframe. Its top layer also covers sticky site controls.
    element?.showModal()
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return <dialog ref={dialog} aria-label={label} aria-modal="true" aria-busy="true"
    onCancel={event => event.preventDefault()}
    className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-[#faf8f5]/95 p-6 text-[#68462f] backdrop:bg-white/70"
    data-testid="payment-processing-overlay">
    <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
      <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-[#b9a58f]/40 border-t-[#68462f]" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  </dialog>
}
