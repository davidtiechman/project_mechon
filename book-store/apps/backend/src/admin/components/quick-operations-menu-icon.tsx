import { Bolt } from "@medusajs/icons"
import { useLayoutEffect, useRef } from "react"

/** Temporary menu-only disablement; Medusa 2.17 has no disabled route config. */
export const QuickOperationsMenuIcon = () => {
  const icon = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const link = icon.current?.closest("a")
    if (!link) return

    const attributes = ["href", "role", "aria-disabled", "tabindex"] as const
    const previous = attributes.map((name) => [name, link.getAttribute(name)] as const)
    const opacity = link.style.opacity
    const cursor = link.style.cursor
    const preventActivation = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    link.removeAttribute("href")
    link.setAttribute("role", "link")
    link.setAttribute("aria-disabled", "true")
    link.setAttribute("tabindex", "-1")
    link.style.opacity = "0.45"
    link.style.cursor = "not-allowed"
    const events = ["click", "auxclick", "keydown"] as const
    events.forEach((name) => link.addEventListener(name, preventActivation, true))

    return () => {
      events.forEach((name) => link.removeEventListener(name, preventActivation, true))
      previous.forEach(([name, value]) => value === null ? link.removeAttribute(name) : link.setAttribute(name, value))
      link.style.opacity = opacity
      link.style.cursor = cursor
    }
  })

  return <span ref={icon} aria-hidden="true" className="inline-flex"><Bolt /></span>
}
