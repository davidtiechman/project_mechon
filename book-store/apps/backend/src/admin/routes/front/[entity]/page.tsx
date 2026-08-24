import { Badge, Button, Container, Heading, Input, Table, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { contentApi } from "../../../lib/content-api"
import { entities } from "../../../lib/content-entities"

const ContentListPage = () => {
  const { entity = "pages" } = useParams()
  const definition = entities[entity]
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!definition) return
    const suffix = entity === "home" ? "?owner_type=home&owner_id=home&limit=100" : entity === "seo" ? "?limit=100" : "?limit=100"
    contentApi<{ items: any[] }>(`/${definition.api}${suffix}`).then((data) => setItems(data.items)).catch(() => setError(true))
  }, [definition, entity])
  const visible = useMemo(() => items.filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase())), [items, search])
  if (!definition) return <Container><Text>{t("siteContent.loadError")}</Text></Container>
  return <Container className="p-0" dir={i18n.dir()}>
    <div className="flex items-center justify-between border-b p-6">
      <div><Heading level="h1">{t(`siteContent.sections.${definition.title}`)}</Heading><Text className="text-ui-fg-subtle">{visible.length}</Text></div>
      <Link to={`/front/${entity}/new`}><Button>{t("siteContent.create")}</Button></Link>
    </div>
    <div className="border-b p-4"><Input placeholder={t("siteContent.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {error ? <Text className="p-6 text-ui-fg-error">{t("siteContent.loadError")}</Text> : visible.length === 0 ? <Text className="p-8 text-center text-ui-fg-subtle">{t("siteContent.noItems")}</Text> :
      <Table><Table.Header><Table.Row><Table.HeaderCell>{t("siteContent.fields.title")}</Table.HeaderCell><Table.HeaderCell>{t("siteContent.status")}</Table.HeaderCell><Table.HeaderCell /></Table.Row></Table.Header>
      <Table.Body>{visible.map((item) => <Table.Row key={item.id}><Table.Cell>{item.title || item.name || item.internal_name || item.question || item.label || item.key}</Table.Cell><Table.Cell>{item.status ? <Badge color={item.status === "published" ? "green" : item.status === "archived" ? "grey" : "orange"}>{t(`siteContent.${item.status}`)}</Badge> : item.active === false ? <Badge color="grey">—</Badge> : <Badge color="green">✓</Badge>}</Table.Cell><Table.Cell className="text-end"><Link to={`/front/${entity}/${item.id}`}><Button variant="secondary" size="small">{t("siteContent.edit")}</Button></Link></Table.Cell></Table.Row>)}</Table.Body></Table>}
  </Container>
}

export default ContentListPage
