"use client"

import { useEffect, useRef, type PointerEvent } from "react"

/** Attach to both the trigger area and any portalled panel. */
export function useHoverMenu(open: () => void, close: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => cancel, [])

  return {
    cancel,
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
      cancel()
      open()
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse") return
      cancel()
      timer.current = setTimeout(close, 250)
    },
    onFocusCapture: cancel,
  }
}
