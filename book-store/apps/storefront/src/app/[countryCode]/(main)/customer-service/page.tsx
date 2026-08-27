import { permanentRedirect } from "next/navigation"

export default async function CustomerServiceRedirect({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  permanentRedirect(`/${countryCode}/pages/customer-service`)
}
