"use client"

import { useEffect, useRef, type PointerEvent } from "react"

export const HEADER_MENU_GROUP = "header-navigation"
const activeMenus = new Map<string, { id: symbol; close: () => void }>()

/** Attach to both the trigger area and any portalled panel. */
export function useHoverMenu(open: () => void, close: () => void, options?: {
  group: string
  closeImmediately: () => void
}) {
  const id = useRef(Symbol("hover-menu")).current
  const group = options?.group
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => () => {
    cancel()
    if (group && activeMenus.get(group)?.id === id) activeMenus.delete(group)
  }, [group, id])

  // Keep the leave delay for crossing into a panel, but never leave a sibling
  // open while the next menu is being activated (including keyboard/click use).
  const activate = () => {
    cancel()
    if (!options) return
    const previous = activeMenus.get(options.group)
    if (previous?.id !== id) previous?.close()
    activeMenus.set(options.group, { id, close: () => {
      cancel()
      options.closeImmediately()
    } })
  }

  return {
    cancel,
    activate,
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
      activate()
      open()
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse") return
      cancel()
      timer.current = setTimeout(close, 250)
    },
    onFocusCapture: activate,
  }
}
