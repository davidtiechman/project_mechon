"use client"

import Image from "next/image"
import { useId, useRef, useState, type KeyboardEvent } from "react"
import { useHoverMenu } from "@lib/hooks/use-hover-menu"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type ProjectMenuItem = {
  slug: string
  title: string
  products?: Array<{ id: string; handle: string; title: string; thumbnail?: string }>
}

function ProjectMenu({ project }: { project: ProjectMenuItem }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const products = project.products || []
  const hover = useHoverMenu(() => setOpen(true), () => {
    if (!panel.current?.contains(document.activeElement)) setOpen(false)
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      ;(event.currentTarget.querySelector("[data-project-link]") as HTMLElement)?.focus()
      setOpen(false)
    } else if (event.key === "ArrowDown" && event.target instanceof HTMLAnchorElement && event.target.hasAttribute("data-project-link")) {
      event.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => panel.current?.querySelector<HTMLAnchorElement>("a")?.focus())
    }
  }

  return (
    <div
      className="relative flex h-full items-center"
      onPointerEnter={hover.onPointerEnter}
      onPointerLeave={hover.onPointerLeave}
      onFocusCapture={() => { hover.onFocusCapture(); setOpen(true) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={handleKeyDown}
    >
      <LocalizedClientLink
        href={`/brands/${project.slug}`}
        className="nav-link whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        data-project-link
      >
        {project.title}
      </LocalizedClientLink>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="region"
          aria-label={`ספרי ${project.title}`}
          className="absolute right-1/2 top-full z-[60] mt-2 w-[min(88vw,520px)] translate-x-1/2 rounded-lg border border-[#dfd0c0] bg-[#faf6f1] p-4 text-right shadow-xl"
        >
            <ul className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto" role="list">
              {products.map((product) => (
                <li key={product.id}>
                  <LocalizedClientLink
                    href={`/products/${product.handle}`}
                    className="flex min-h-[76px] items-center gap-3 rounded-md p-2 text-base font-semibold text-[#4b3c2c] transition-colors hover:bg-[#efe4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7130]"
                  >
                    <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded border border-[#e2d6ca] bg-white">
                      {product.thumbnail ? <Image src={product.thumbnail} alt="" fill sizes="48px" className="object-contain" /> : <span className="grid h-full place-items-center text-xs text-[#8d8275]" aria-hidden="true">ספר</span>}
                    </span>
                    <span className="whitespace-normal leading-5">{product.title}</span>
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          <LocalizedClientLink
            href={`/brands/${project.slug}`}
            className="mt-3 flex border-t border-[#dfd0c0] px-2 pt-3 text-base font-bold text-[#7b552e] hover:text-[#4a2d21] focus-visible:outline focus-visible:outline-2"
          >
            {["חדשים", "ספרים חדשים"].includes(project.title.trim())
              ? "לכל הספרים חדשים"
              : `לכל ספרי ${project.title}`}
          </LocalizedClientLink>
        </div>
      )}
    </div>
  )
}

export default function InstituteProjectsMenu({ projects }: { projects: ProjectMenuItem[] }) {
  return <>{projects.map((project) => <ProjectMenu key={project.slug} project={project} />)}</>
}
