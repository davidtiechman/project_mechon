"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react"

type Position = { x: number; y: number }
type Drag = { pointerId: number; startX: number; startY: number; origin: Position; moved: boolean }

export function boundLauncher(position: Position, width: number, height: number, viewportWidth: number, viewportHeight: number): Position {
  return {
    x: Math.max(8, Math.min(position.x, Math.max(8, viewportWidth - width - 8))),
    y: Math.max(8, Math.min(position.y, Math.max(8, viewportHeight - height - 8))),
  }
}

/** Position is deliberately held in memory: a page refresh restores the CSS default. */
export function useDraggableLauncher(container: RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<Position | null>(null)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const bound = (next: Position) => {
    const rect = container.current?.getBoundingClientRect()
    return rect ? boundLauncher(next, rect.width, rect.height, window.innerWidth, window.innerHeight) : next
  }

  useEffect(() => {
    const element = container.current
    if (!element) return
    const keepVisible = () => setPosition((current) => {
      if (!current) return current
      const rect = element.getBoundingClientRect()
      const next = boundLauncher(current, rect.width, rect.height, window.innerWidth, window.innerHeight)
      return next.x === current.x && next.y === current.y ? current : next
    })
    const observer = new ResizeObserver(keepVisible)
    observer.observe(element)
    window.addEventListener("resize", keepVisible)
    return () => { observer.disconnect(); window.removeEventListener("resize", keepVisible) }
  }, [container])

  return {
    position,
    shouldSuppressClick: () => {
      const suppressed = suppressClick.current
      suppressClick.current = false
      return suppressed
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0 || !event.isPrimary) return
      const rect = container.current?.getBoundingClientRect()
      if (!rect) return
      suppressClick.current = false
      drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { x: rect.left, y: rect.top }, moved: false }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return
      const dx = event.clientX - current.startX, dy = event.clientY - current.startY
      if (!current.moved && Math.hypot(dx, dy) < 6) return
      current.moved = true
      setPosition(bound({ x: current.origin.x + dx, y: current.origin.y + dy }))
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      if (drag.current?.pointerId !== event.pointerId) return
      suppressClick.current = drag.current.moved
      drag.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    },
    onPointerCancel: () => { drag.current = null; suppressClick.current = false },
    onLostPointerCapture: () => {
      if (drag.current) { suppressClick.current = drag.current.moved; drag.current = null }
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      const steps: Record<string, Position> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } }
      const step = steps[event.key]
      if (!step || event.altKey || event.ctrlKey || event.metaKey) return
      const rect = container.current?.getBoundingClientRect()
      if (!rect) return
      event.preventDefault()
      setPosition(bound({ x: rect.left + step.x, y: rect.top + step.y }))
    },
  }
}
