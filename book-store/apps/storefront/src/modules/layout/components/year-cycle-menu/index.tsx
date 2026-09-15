"use client"

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { useRef } from "react"
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
}) => (
  <li className={depth ? "border-r border-[#dfd0c0] pr-4" : ""}>
    <span className="block font-semibold text-[#4b3c2c]">{node.name}</span>
    {(node.children.length > 0 || node.products.length > 0) && (
      <ul className="mt-2 space-y-2">
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
          <PopoverButton ref={button} onClick={hover.cancel} className="nav-link h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {menu.name}
          </PopoverButton>
          <PopoverPanel
            ref={panel}
            onPointerEnter={hover.onPointerEnter}
            onPointerLeave={hover.onPointerLeave}
            onFocusCapture={hover.onFocusCapture}
            modal={false}
            anchor="bottom"
            className="z-[60] mt-2 max-h-[70vh] w-[min(90vw,760px)] overflow-y-auto rounded-lg border border-[#dfd0c0] bg-[#faf6f1] p-6 text-right shadow-xl [--anchor-gap:8px]"
          >
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {menu.children.map((child) => (
                <MenuBranch key={child.id} node={child} close={close} />
              ))}
              {menu.products.map((product) => (
                <li key={product.id}>
                  <LocalizedClientLink
                    href={`/products/${product.handle}`}
                    onClick={() => close()}
                    className="block rounded px-2 py-1 font-medium text-[#6b5339] hover:bg-[#efe4d8]"
                  >
                    {product.title}
                  </LocalizedClientLink>
                </li>
              ))}
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
