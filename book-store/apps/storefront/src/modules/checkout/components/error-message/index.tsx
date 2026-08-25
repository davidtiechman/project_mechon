"use client"

import { useEffect, useId, useRef } from "react"

const ErrorMessage = ({
  error,
  "data-testid": dataTestid,
}: {
  error?: string | null
  "data-testid"?: string
}) => {
  const errorId = useId()
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true })
  }, [error])

  if (!error) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      id={errorId}
      ref={errorRef}
      tabIndex={-1}
      className="pt-2 text-rose-700 text-small-regular"
      data-testid={dataTestid}
    >
      <span>{error}</span>
    </div>
  )
}

export default ErrorMessage
