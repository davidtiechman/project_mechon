import { getInstituteProject, instituteProjects } from "@lib/data/institute-projects"
import InstituteProjectTemplate from "@modules/institute-projects/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string; slug: string }>
}

export const generateStaticParams = () =>
  instituteProjects.map(({ slug }) => ({ slug }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = getInstituteProject(slug)
  if (!project) notFound()

  return {
    title: `${project.title} | `,
    description: project.description,
  }
}

export default async function InstituteProjectPage({ params }: Props) {
  const { countryCode, slug } = await params
  const project = getInstituteProject(slug)
  if (!project) notFound()

  return <InstituteProjectTemplate project={project} countryCode={countryCode} />
}
