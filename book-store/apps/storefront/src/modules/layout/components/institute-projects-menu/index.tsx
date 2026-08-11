"use client"

import { instituteProjects as fallbackProjects } from "@lib/data/institute-projects"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useState } from "react"

export default function InstituteProjectsMenu({ projects = fallbackProjects.map((project) => ({ slug: project.slug, title: project.title })) }: { projects?: Array<{ slug: string; title: string }> }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative flex h-full items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false)
          event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus()
        }
      }}
    >
      <button
        type="button"
        className="nav-link bg-transparent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="institute-projects-menu"
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
      >
        מפעלי המכון
      </button>

      <div
        id="institute-projects-menu"
        role="menu"
        aria-label="מפעלי המכון"
        className={`absolute right-0 top-full min-w-[220px] border border-[#ddcec0] bg-[#faf6f1] py-2 shadow-xl transition duration-150 ${open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"}`}
      >
        {instituteProjects.map((project) => (
          <LocalizedClientLink
            key={project.slug}
            href={`/brands/${project.slug}`}
            role="menuitem"
            className="block px-5 py-3 text-right text-[#3b352a] transition-colors hover:bg-[#f0e4d8] hover:text-[#8a682d] focus:bg-[#f0e4d8] focus:outline-none"
            onClick={() => setOpen(false)}
          >
            {project.title}
          </LocalizedClientLink>
        ))}
      </div>
    </div>
  )
}
