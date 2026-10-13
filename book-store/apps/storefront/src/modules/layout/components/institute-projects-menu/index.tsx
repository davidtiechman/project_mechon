"use client"

import Image from "next/image"
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { useLayoutEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { useHoverMenu } from "@lib/hooks/use-hover-menu"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export type ProjectMenuItem = {
  slug: string
  title: string
  products?: Array<{ id: string; handle: string; title: string; thumbnail?: string }>
}

const isPinnedProject = (project: ProjectMenuItem) => {
  const title = project.title.replace(/[\s־–-]+/g, " ").trim()
  return title.includes("מזכרות") || title.includes("נשים וילדים")
}

const MAX_VISIBLE_PROJECTS = 8

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

function MoreProjects({ projects, open, close }: {
  projects: ProjectMenuItem[]
  open: boolean
  close: (target?: HTMLElement) => void
}) {
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const hover = useHoverMenu(() => {
    if (!open) button.current?.click()
  }, () => {
    const focused = document.activeElement
    if (panel.current?.contains(focused)) return
    close(focused instanceof HTMLElement ? focused : undefined)
  })

  return (
    <div className="flex h-full items-center" onPointerEnter={hover.onPointerEnter} onPointerLeave={hover.onPointerLeave} onFocusCapture={hover.onFocusCapture}>
      <PopoverButton ref={button} onClick={hover.cancel} className="nav-link gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        עוד
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
        anchor="bottom end"
        dir="rtl"
        aria-label="דפים נוספים"
        style={{ fontFamily: '"Sd Hadasa Local", serif' }}
        className="z-[60] max-h-[70vh] w-[min(90vw,280px)] overflow-y-auto rounded-lg border border-[#dfd0c0] bg-[#faf6f1] p-2 text-right shadow-xl [--anchor-gap:8px]"
      >
        <ul>
          {projects.map((project) => (
            <li key={project.slug}>
              <LocalizedClientLink href={`/brands/${project.slug}`} onClick={() => close()} className="block whitespace-normal rounded-md px-4 py-3 text-xl font-semibold text-[#4b3c2c] hover:bg-[#efe4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7130]">
                {project.title}
              </LocalizedClientLink>
            </li>
          ))}
          <li>
            <LocalizedClientLink href="/#about" onClick={() => close()} className="block rounded-md px-4 py-3 text-xl font-semibold text-[#4b3c2c] hover:bg-[#efe4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7130]">
              אודות
            </LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink href="/#articles" onClick={() => close()} className="block rounded-md px-4 py-3 text-xl font-semibold text-[#4b3c2c] hover:bg-[#efe4d8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7130]">
              מאמרים
            </LocalizedClientLink>
          </li>
        </ul>
      </PopoverPanel>
    </div>
  )
}

export default function InstituteProjectsMenu({ projects, leading, trailing, ending }: {
  projects: ProjectMenuItem[]
  leading?: ReactNode
  trailing?: ReactNode
  ending?: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const measurements = useRef<HTMLDivElement>(null)
  const leadingSlot = useRef<HTMLDivElement>(null)
  const trailingSlot = useRef<HTMLDivElement>(null)
  const endingSlot = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(() => Math.min(MAX_VISIBLE_PROJECTS, projects.length))
  const prioritizedProjects = useMemo(() => [
    ...projects.filter(isPinnedProject),
    ...projects.filter((project) => !isPinnedProject(project)),
  ], [projects])
  const pinnedCount = projects.filter(isPinnedProject).length
  const visibleSlugs = new Set(prioritizedProjects.slice(0, Math.max(pinnedCount, visibleCount)).map((project) => project.slug))
  const visibleProjects = projects.filter((project) => visibleSlugs.has(project.slug))
  const overflowProjects = projects.filter((project) => !visibleSlugs.has(project.slug))

  useLayoutEffect(() => {
    const slot = container.current
    const ruler = measurements.current
    if (!slot || !ruler) return

    // “More” always contains About and Articles. Keep the pinned departments
    // visible and move other projects there first when space is limited.
    const measure = () => {
      const widths = Array.from(ruler.children).map((child) => child.getBoundingClientRect().width)
      const moreWidth = widths.pop() || 0
      const gap = parseFloat(getComputedStyle(slot).columnGap) || 0
      const fixedSlots = [leadingSlot.current, trailingSlot.current, endingSlot.current].filter((element) => !!element)
      const availableWidth = slot.clientWidth - fixedSlots.reduce((sum, element) => sum + element!.getBoundingClientRect().width + gap, 0)
      let count = Math.min(MAX_VISIBLE_PROJECTS, projects.length)
      while (count > pinnedCount) {
        const width = widths.slice(0, count).reduce((sum, value) => sum + value, 0)
          + Math.max(0, count - 1) * gap + moreWidth + gap
        if (width <= availableWidth) break
        count--
      }
      setVisibleCount(count)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(slot)
    Array.from(ruler.children).forEach((child) => observer.observe(child))
    if (leadingSlot.current) observer.observe(leadingSlot.current)
    if (trailingSlot.current) observer.observe(trailingSlot.current)
    if (endingSlot.current) observer.observe(endingSlot.current)
    measure()
    return () => observer.disconnect()
  }, [projects, pinnedCount, leading, trailing, ending])

  return (
    <div ref={container} className="relative flex h-full min-w-0 flex-1 items-center justify-center gap-2">
      <div ref={measurements} aria-hidden="true" className="pointer-events-none invisible absolute flex w-max gap-3 font-semibold">
        {prioritizedProjects.slice(0, MAX_VISIBLE_PROJECTS).map((project) => <span key={project.slug} className="whitespace-nowrap">{project.title}</span>)}
        <span className="flex items-center gap-1 whitespace-nowrap">עוד<span className="w-4" /></span>
      </div>
      {leading && <div ref={leadingSlot} className="flex h-full shrink-0 items-center gap-2">{leading}</div>}
      {visibleProjects.map((project) => <ProjectMenu key={project.slug} project={project} />)}
      {trailing && <div ref={trailingSlot} className="flex h-full shrink-0 items-center gap-2">{trailing}</div>}
        <Popover className="relative flex h-full shrink-0 items-center">
          {({ open, close }) => <MoreProjects projects={overflowProjects} open={open} close={close} />}
        </Popover>
      {ending && <div ref={endingSlot} className="flex h-full shrink-0 items-center gap-2">{ending}</div>}
    </div>
  )
}
