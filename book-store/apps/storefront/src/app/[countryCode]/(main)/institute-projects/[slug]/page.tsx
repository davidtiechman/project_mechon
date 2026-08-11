import { permanentRedirect } from "next/navigation"

export default async function InstituteProjectPage({
  params,
}: {
  params: Promise<{ countryCode: string; slug: string }>
}) {
  const { countryCode, slug } = await params
  permanentRedirect(`/${countryCode}/brands/${slug}`)
}
