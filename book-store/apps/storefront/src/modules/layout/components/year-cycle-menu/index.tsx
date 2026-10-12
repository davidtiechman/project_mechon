"use client"

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { useId, useRef, useState } from "react"
import { useHoverMenu } from "@lib/hooks/use-hover-menu"
import type { YearCycleMenuNode } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const MenuBranch = ({
  node,
  close,
  depth = 0,
}: {
  node: YearCycleMenuNode
  close: () => void
  depth?: number
}) => {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const branch = useRef<HTMLLIElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const hasContent = node.children.length > 0 || node.products.length > 0
  const hover = useHoverMenu(() => setOpen(true), () => {
    if (!branch.current?.contains(document.activeElement)) setOpen(false)
  })

  return (
  <li
    ref={branch}
    className={depth ? "border-r border-[#dfd0c0] pr-4" : ""}
    onPointerEnter={hover.onPointerEnter}
    onPointerLeave={hover.onPointerLeave}
    onFocusCapture={hover.onFocusCapture}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation()
        hover.cancel()
        setOpen(false)
        button.current?.focus()
      }
    }}
  >
    {hasContent ? (
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => { hover.cancel(); setOpen((value) => !value) }}
        className="flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-right font-semibold text-[#4b3c2c] hover:bg-[#efe4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7130]"
      >
        {node.name}
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
    ) : <span className="block px-2 py-2 font-semibold text-[#4b3c2c]">{node.name}</span>}
    {hasContent && open && (
      <ul id={listId} className="mt-2 space-y-2">
        {node.children.map((child) => (
          <MenuBranch
            key={child.id}
            node={child}
            close={close}
            depth={depth + 1}
          />
        ))}
        {node.products.map((product) => (
          <li key={product.id}>
            <LocalizedClientLink
              href={`/products/${product.handle}`}
              onClick={() => close()}
              className="block rounded px-2 py-1 text-[#6b5339] transition-colors hover:bg-[#efe4d8] hover:text-[#2f251b]"
            >
              {product.title}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    )}
  </li>
  )
}

function MenuContent({ menu, open, close }: {
  menu: YearCycleMenuNode
  open: boolean
  close: (target?: HTMLElement) => void
}) {
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const hover = useHoverMenu(() => {
    if (open) return
    // Headless UI owns the disclosure state and keyboard interactions.
    button.current?.click()
  }, () => {
    // Do not hide links while someone is navigating them with a keyboard.
    const focused = document.activeElement
    if (panel.current?.contains(focused)) return
    close(focused instanceof HTMLElement ? focused : undefined)
  })
  return (
        <div className="flex h-full items-center" onPointerEnter={hover.onPointerEnter} onPointerLeave={hover.onPointerLeave} onFocusCapture={hover.onFocusCapture}>
          <PopoverButton ref={button} onClick={hover.cancel} className="nav-link h-full gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {menu.name}
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </PopoverButton>
          <PopoverPanel
            ref={panel}
            onPointerEnter={hover.onPointerEnter}
            onPointerLeave={hover.onPointerLeave}
            onFocusCapture={hover.onFocusCapture}
            modal={false}
            anchor="bottom"
            dir="rtl"
            className="z-[60] mt-2 max-h-[70vh] w-[min(90vw,760px)] overflow-y-auto rounded-lg border border-[#dfd0c0] bg-[#faf6f1] p-6 text-right shadow-xl [--anchor-gap:8px]"
          >
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {menu.children.map((child) => (
                <MenuBranch key={child.id} node={child} close={close} />
              ))}
              {menu.products.length > 0 && (
                <MenuBranch node={{ ...menu, name: menu.children.length ? "ספרים נוספים" : menu.name, children: [] }} close={close} />
              )}
            </ul>
          </PopoverPanel>
        </div>
  )
}

export default function YearCycleMenu({ menu }: { menu: YearCycleMenuNode }) {
  return (
    <Popover className="relative flex h-full items-center">
      {({ open, close }) => <MenuContent menu={menu} open={open} close={close} />}
    </Popover>
  )
}
