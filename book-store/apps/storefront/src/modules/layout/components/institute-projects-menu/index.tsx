import { instituteProjects as fallbackProjects } from "@lib/data/institute-projects"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function InstituteProjectsMenu({ projects = fallbackProjects.map((project) => ({ slug: project.slug, title: project.title })) }: { projects?: Array<{ slug: string; title: string }> }) {
  return (
    <>
        {projects.map((project) => (
          <LocalizedClientLink
            key={project.slug}
            href={`/brands/${project.slug}`}
            className="nav-link whitespace-nowrap"
          >
            {project.title}
          </LocalizedClientLink>
        ))}
    </>
  )
}
