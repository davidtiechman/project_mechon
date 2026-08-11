import { Button, Container, Heading, Input, Label, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { RichTextEditor } from "../../../../components/rich-text-editor"
import { contentApi } from "../../../../lib/content-api"
import { uploadContentImage } from "../../../../lib/content-api"
import { entities, Field } from "../../../../lib/content-entities"

function FieldControl({ field, value, onChange, rtl, t }: { field: Field; value: any; onChange: (value: any) => void; rtl: boolean; t: (key: string) => string }) {
  if (field.type === "rich") return <RichTextEditor value={value || ""} onChange={onChange} rtl={rtl} />
  if (field.type === "textarea" || field.type === "json") return <Textarea rows={field.type === "json" ? 8 : 4} value={typeof value === "object" ? JSON.stringify(value, null, 2) : value || ""} onChange={(event) => onChange(event.target.value)} />
  if (field.type === "boolean") return <Switch checked={value !== false} onCheckedChange={onChange} />
  if (field.type === "image") return <div className="flex flex-col gap-2"><Input value={value || ""} onChange={(event) => onChange(event.target.value)} /><Input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onChange(await uploadContentImage(file)) }} /></div>
  if (field.type === "products") return <ProductPicker value={value || []} onChange={onChange} />
  if (field.type === "status") return <Select value={value || "draft"} onValueChange={onChange}><Select.Trigger><Select.Value /></Select.Trigger><Select.Content><Select.Item value="draft">{t("siteContent.draft")}</Select.Item><Select.Item value="published">{t("siteContent.published")}</Select.Item><Select.Item value="archived">{t("siteContent.archived")}</Select.Item></Select.Content></Select>
  return <Input type={field.type === "number" ? "number" : "text"} required={field.required} value={value ?? ""} onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)} />
}

function ProductPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [products, setProducts] = useState<any[]>([])
  useEffect(() => { fetch("/admin/products?limit=100&fields=id,title,thumbnail", { credentials: "include" }).then((response) => response.json()).then((data) => setProducts(data.products || [])).catch(() => undefined) }, [])
  return <div className="max-h-64 overflow-auto rounded-lg border border-ui-border-base p-3">{products.map((product) => <label className="flex items-center gap-2 border-b py-2 last:border-0" key={product.id}><input type="checkbox" checked={value.includes(product.id)} onChange={(event) => onChange(event.target.checked ? [...value, product.id] : value.filter((id) => id !== product.id))} /><span>{product.title}</span></label>)}</div>
}

export default function ContentEditorPage() {
  const { entity = "pages", id = "new" } = useParams()
  const definition = entities[entity]
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState<Record<string, any>>({ status: "draft", active: true, sort_order: 0 })
  const [loading, setLoading] = useState(id !== "new")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const rtl = i18n.dir() === "rtl"
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn) }, [dirty])
  useEffect(() => {
    if (!definition || id === "new") return
    Promise.all([contentApi<{ item: any }>(`/${definition.api}/${id}`), entity === "brands" ? contentApi<{ products: any[] }>(`/brands/${id}/products`) : Promise.resolve({ products: [] })]).then(([{ item }, related]) => setForm({ ...item, products: related.products.map((product) => product.id) })).catch(() => toast.error(t("siteContent.loadError"))).finally(() => setLoading(false))
  }, [definition, id, t])
  const initial = useMemo(() => entity === "home" ? { owner_type: "home", owner_id: "home", type: "text" } : entity === "seo" ? { key: "seo" } : entity === "navigation" ? { menu_id: "main" } : entity === "banners" ? { placement: "global" } : {}, [entity])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const payload = { ...initial, ...form }
      const productIds = payload.products
      delete payload.products
      for (const field of definition.fields.filter((field) => field.type === "json")) if (typeof payload[field.name] === "string") payload[field.name] = JSON.parse(payload[field.name] || "{}")
      const saved = await contentApi<{ item: { id: string } }>(`/${definition.api}${id === "new" ? "" : `/${id}`}`, { method: "POST", body: JSON.stringify(payload) })
      if (entity === "brands" && Array.isArray(productIds)) await contentApi(`/brands/${saved.item.id}/products`, { method: "POST", body: JSON.stringify({ product_ids: productIds }) })
      setDirty(false); toast.success(t("siteContent.saveSuccess")); navigate(`/front/${entity}`)
    } catch { toast.error(t("siteContent.saveError")) } finally { setSaving(false) }
  }
  if (!definition) return <Container><Text>{t("siteContent.loadError")}</Text></Container>
  if (loading) return <Container><Text>{t("siteContent.saving")}</Text></Container>
  return <form onSubmit={submit} dir={i18n.dir()} className="flex flex-col gap-3">
    <Container className="flex items-center justify-between p-6"><Heading level="h1">{t(`siteContent.sections.${definition.title}`)}</Heading><div className="flex gap-2"><Link to={`/front/${entity}`}><Button type="button" variant="secondary">{t("siteContent.cancel")}</Button></Link><Button type="submit" disabled={saving}>{saving ? t("siteContent.saving") : t("siteContent.save")}</Button></div></Container>
    <Container className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-2">{definition.fields.map((field) => <div key={field.name} className={field.type === "rich" || field.type === "textarea" || field.type === "json" || field.type === "products" ? "lg:col-span-2" : ""}><Label className="mb-2 block">{t(`siteContent.fields.${field.name}`)}</Label><FieldControl field={field} value={form[field.name]} rtl={rtl} t={t} onChange={(value) => { setDirty(true); setForm((current) => ({ ...current, [field.name]: value })) }} /></div>)}</Container>
  </form>
}
