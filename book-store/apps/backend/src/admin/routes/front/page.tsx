import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BookOpen } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { contentApi } from "../../lib/content-api"

const destinations = ["home", "pages", "brands", "articles", "banners", "navigation", "faq", "footer", "seo", "settings"]

export default function SiteContentDashboard() {
  const { t, i18n } = useTranslation()
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => { contentApi<{ counts: Record<string, number> }>("/dashboard").then((data) => setCounts(data.counts)).catch(() => undefined) }, [])
  return <div className="flex flex-col gap-3" dir={i18n.dir()}>
    <Container className="p-6">
      <Heading level="h1">{t("siteContent.title")}</Heading>
      <Text className="mt-2 text-ui-fg-subtle">{t("siteContent.subtitle")}</Text>
    </Container>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {destinations.map((name) => <Link to={`/front/${name}`} key={name}>
        <Container className="h-full p-5 transition-shadow hover:shadow-elevation-card-hover">
          <div className="flex items-center justify-between">
            <Heading level="h2">{t(`siteContent.sections.${name}`)}</Heading>
            {counts[name] !== undefined && <Text size="xlarge" weight="plus">{counts[name]}</Text>}
          </div>
        </Container>
      </Link>)}
    </div>
  </div>
}

export const config = defineRouteConfig({ label: "siteContent.menu", icon: BookOpen, rank: 70 })
