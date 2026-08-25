"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

const steps = [
  { id: "address", label: "פרטי לקוח וכתובת" },
  { id: "delivery", label: "משלוח" },
  { id: "payment", label: "תשלום" },
  { id: "review", label: "אישור הזמנה" },
]

export default function CheckoutSteps() {
  const searchParams = useSearchParams()
  const currentStep = searchParams.get("step") || "address"
  const currentLabel = steps.find((step) => step.id === currentStep)?.label

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>(
      `[data-checkout-step-heading="${currentStep}"]`,
    )
    heading?.focus({ preventScroll: true })
  }, [currentStep])

  return (
    <>
      <nav aria-label="שלבי השלמת ההזמנה" className="mb-8">
        <ol className="flex flex-wrap gap-x-5 gap-y-2 text-small-regular">
          {steps.map((step, index) => (
            <li
              key={step.id}
              aria-current={step.id === currentStep ? "step" : undefined}
              className={step.id === currentStep ? "font-semibold text-ui-fg-base" : "text-ui-fg-subtle"}
            >
              <span aria-hidden="true">{index + 1}. </span>{step.label}
            </li>
          ))}
        </ol>
      </nav>
      <p className="sr-only" role="status" aria-live="polite">
        {currentLabel ? `השלב הפעיל: ${currentLabel}` : ""}
      </p>
    </>
  )
}
