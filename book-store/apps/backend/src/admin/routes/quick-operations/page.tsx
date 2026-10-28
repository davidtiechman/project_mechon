import { defineRouteConfig } from "@medusajs/admin-sdk"
import { QuickOperationsMenuIcon } from "../../components/quick-operations-menu-icon"
import { Button, Container, Heading, Input, Text, Textarea, toast } from "@medusajs/ui"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { uploadContentImage } from "../../lib/content-api"
import { quickBookSchema, shippingWarnings, type Choice, type QuickBook, type QuickSettings } from "../../../shared/quick-book"

class ApiError extends Error {
  constructor(public code: string, public productId?: string, public issues?: { path: string; code: string }[]) { super(code) }
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init, headers: { "content-type": "application/json", ...init?.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status === 401 || response.status === 403 ? "unauthorized" : data.code || "saveError", data.product_id, data.issues)
  return data
}
const freshVariant = (): QuickBook["variants"][number] => ({ size: "", binding: "", price: 0, sku: `BOOK-${crypto.randomUUID()}`, stock: [{ location_id: "", quantity: 0 }] })
const freshBook = (): QuickBook => ({ request_id: crypto.randomUUID(), title: "", description: "", handle: `book-${crypto.randomUUID()}`, status: "draft", images: [], brand_id: "", category_ids: [], collection_id: "", sales_channel_id: "", shipping_profile_id: "", currency_code: "", manage_inventory: true, allow_backorder: false, variants: [freshVariant()] })
type Defaults = Pick<QuickBook, "sales_channel_id" | "shipping_profile_id" | "currency_code" | "manage_inventory" | "allow_backorder"> & { location_id: string }

const sharedKeys: Record<string, string> = { description: "fields.description", currency: "fields.currency", sku: "fields.sku", collection: "fields.collection", categories: "fields.categories", handle: "fields.handle", manageInventory: "fields.manageInventory", backorder: "products.variant.inventory.allowBackordersLabel", saveDraft: "actions.saveAsDraft" }

const QuickOperations = () => {
  const { t, i18n } = useTranslation()
  const q = (key: string, values?: Record<string, any>) => t(sharedKeys[key] || `quickOperations.${key}`, values)
  const [book, setBook] = useState<QuickBook>(freshBook)
  const [settings, setSettings] = useState<QuickSettings>()
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false)
  const [error, setError] = useState(""), [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ id: string; title: string }>(), [partial, setPartial] = useState<string>()
  const [showSettings, setShowSettings] = useState(false), [commonBinding, setCommonBinding] = useState("")
  const [split, setSplit] = useState(false), [defaultsKey, setDefaultsKey] = useState("")
  const defaults = useRef<Defaults | undefined>(undefined), initialized = useRef(false), saving = useRef(false), uploadLock = useRef(false)
  const frozenPayload = useRef<QuickBook | undefined>(undefined)
  const filesInput = useRef<HTMLInputElement>(null)
  const blocked = busy || uploading || uncertain || !!partial || !!result
  const change = <K extends keyof QuickBook>(key: K, value: QuickBook[K]) => { setBook((b) => ({ ...b, [key]: value })); setErrors({}); setError("") }
  const variant = (index: number, patch: Partial<QuickBook["variants"][number]>) => change("variants", book.variants.map((v, i) => i === index ? { ...v, ...patch } : v))

  async function load() {
    setLoading(true); setLoadError(false)
    try {
      const [data, me] = await Promise.all([api<QuickSettings>("/admin/quick-operations/settings"), api<{ user: { id: string } }>("/admin/users/me")])
      setSettings(data)
      const key = `quick-book-defaults:${me.user.id}`
      setDefaultsKey(key)
      if (!initialized.current) {
        let saved: Partial<Defaults> = {}
        try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {} } catch { /* preferences are optional */ }
        const select = (rows: Choice[], stored?: string, hint?: string) => {
          if (stored && rows.some((r) => r.id === stored)) return stored
          const matches = rows.filter((r) => r.name === hint)
          return matches.length === 1 ? matches[0].id : rows.length === 1 ? rows[0].id : ""
        }
        const d: Defaults = {
          location_id: select(data.locations, saved.location_id, "מחסן מכון מעשה רוקח"),
          sales_channel_id: select(data.channels, saved.sales_channel_id, "Default Sales Channel"),
          shipping_profile_id: select(data.profiles, saved.shipping_profile_id, "Default Shipping Profile"),
          currency_code: data.currencies.includes(saved.currency_code || "") ? saved.currency_code! : data.currencies.includes("ils") ? "ils" : data.currencies.length === 1 ? data.currencies[0] : "",
          manage_inventory: saved.manage_inventory !== false, allow_backorder: saved.allow_backorder === true,
        }
        defaults.current = d
        setBook((b) => ({ ...b, ...d, variants: b.variants.map((v) => ({ ...v, stock: [{ location_id: d.location_id, quantity: 0 }] })) }))
        setShowSettings(!d.location_id || !d.sales_channel_id || !d.shipping_profile_id || !d.currency_code)
        initialized.current = true
      }
    } catch { setLoadError(true) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const fieldError = (path: string) => errors[path] ? <Text id={`error-${path}`} role="alert" className="text-ui-fg-error">{q(errors[path])}</Text> : null
  const field = (name: string, label: string, control: ReactNode) => <div className="flex min-w-0 flex-col gap-1"><label htmlFor={name} className="text-sm font-medium">{label}</label>{control}{fieldError(name)}</div>
  const input = (path: string, value: string | number, update: (value: string) => void, numeric = false) => <Input id={path} value={Number.isNaN(value) ? "" : value} type={numeric ? "number" : "text"} min={numeric ? 0 : undefined} step={numeric ? path.includes("quantity") ? 1 : "any" : undefined} dir={numeric || path.includes("sku") || path === "handle" ? "ltr" : undefined} aria-invalid={!!errors[path]} aria-describedby={errors[path] ? `error-${path}` : undefined} onChange={(e) => update(e.target.value)} />
  const select = (path: string, rows: Choice[], value: string, update: (v: string) => void, optional = false) => <div><select id={path} value={value} onChange={(e) => update(e.target.value)} aria-invalid={!!errors[path]} className="w-full rounded-md border bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base"><option value="">{optional ? q("none") : q("choose")}</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{!rows.length && <Text>{q("emptyList")}</Text>}</div>

  async function upload(files: File[]) {
    if (uploadLock.current || saving.current || partial || result) return
    if (files.length + book.images.length > 20 || files.some((f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 2 * 1024 * 1024)) { setError("imageType"); return }
    uploadLock.current = true; setUploading(true); setError("")
    try {
      for (const file of files) {
        const url = await uploadContentImage(file)
        setBook((b) => ({ ...b, images: [...b.images, url] }))
      }
    } catch { setError("uploadError") } finally { uploadLock.current = false; setUploading(false) }
  }

  async function save(status: QuickBook["status"]) {
    if (saving.current || uploadLock.current || partial || result) return
    const payload = uncertain && frozenPayload.current ? frozenPayload.current : { ...book, status }
    const parsed = quickBookSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.code === "custom" ? issue.message : "invalid"]))); setError("validation"); return
    }
    const decimals = new Intl.NumberFormat("en", { style: "currency", currency: parsed.data.currency_code }).resolvedOptions().maximumFractionDigits ?? 2
    const priceErrors = Object.fromEntries(parsed.data.variants.flatMap((v, i) => Math.abs(v.price * 10 ** decimals - Math.round(v.price * 10 ** decimals)) > 1e-6 ? [[`variants.${i}.price`, "pricePrecision"]] : []))
    if (Object.keys(priceErrors).length) { setErrors(priceErrors); setError("validation"); return }
    saving.current = true; setBusy(true); setErrors({}); setError("")
    // Preserve the exact request across network retries; a changed form uses a new request ID.
    if (frozenPayload.current && JSON.stringify({ ...parsed.data, request_id: "" }) !== JSON.stringify({ ...frozenPayload.current, request_id: "" })) parsed.data.request_id = crypto.randomUUID()
    frozenPayload.current = parsed.data
    setBook(parsed.data)
    try {
      const data = await api<{ product: { id: string; title: string } }>("/admin/quick-operations/books", { method: "POST", body: JSON.stringify(parsed.data) })
      setUncertain(false)
      setResult(data.product)
    } catch (caught) {
      const e = caught instanceof ApiError ? caught : new ApiError("saveError")
      const known = ["unauthorized", "validation", "partial", "requestChanged", "staleSettings", "channelMismatch", "pricePrecision", "handleConflict", "duplicateSku", "saveError"]
      setError(known.includes(e.code) ? e.code : "saveError")
      setUncertain(e.code === "saveError")
      if (e.productId) setPartial(e.productId)
      if (e.issues) setErrors(Object.fromEntries(e.issues.map((i) => [i.path, i.code])))
    } finally { saving.current = false; setBusy(false) }
  }
  async function saveDefaults() {
    if (!settings || !defaultsKey || saving.current) return
    saving.current = true; setBusy(true)
    try {
      const current = await api<QuickSettings>("/admin/quick-operations/settings")
      setSettings(current)
      const d: Defaults = { location_id: book.variants[0].stock[0].location_id, sales_channel_id: book.sales_channel_id, shipping_profile_id: book.shipping_profile_id, currency_code: book.currency_code, manage_inventory: book.manage_inventory, allow_backorder: book.allow_backorder }
      if (!current.locations.some((l) => l.id === d.location_id) || !current.channels.some((c) => c.id === d.sales_channel_id) || !current.profiles.some((p) => p.id === d.shipping_profile_id) || !current.currencies.includes(d.currency_code)) { setError("staleSettings"); return }
      try { localStorage.setItem(defaultsKey, JSON.stringify(d)); defaults.current = d; toast.success(q("defaultsSaved")) } catch { setError("defaultsError") }
    } catch { setError("loadError") } finally { saving.current = false; setBusy(false) }
  }
  const reset = () => {
    const b = freshBook(), d = defaults.current
    if (d) { Object.assign(b, d); b.variants[0].stock[0].location_id = d.location_id }
    setBook(b); setResult(undefined); setError(""); setErrors({}); setSplit(false); setCommonBinding(""); frozenPayload.current = undefined
  }
  const name = (rows: Choice[], id: string) => rows.find((r) => r.id === id)?.name || q("choose")
  const warnings = settings ? [...new Set(shippingWarnings(book, settings))] : []
  const missing = settings && (!settings.locations.length || !settings.channels.length || !settings.profiles.length || !settings.currencies.length)

  return <div dir={i18n.dir()} className="flex flex-col gap-4">
    <Container><Heading level="h1">{q("title")}</Heading><Text>{q("intro")}</Text></Container>
    {loading && <Text role="status">{q("loading")}</Text>}
    {loadError && <Text role="alert">{q("loadError")}</Text>}
    <div><Button variant="secondary" onClick={load} disabled={blocked || loading}>{q("refresh")}</Button></div>
    {missing && <Text role="alert">{q("emptySettings")}</Text>}
    {error && <Text role="alert" className="text-ui-fg-error">{q(error)}</Text>}
    {uncertain && !partial && <Button disabled={busy} onClick={() => save(frozenPayload.current?.status || "draft")}>{q(busy ? "saving" : "retry")}</Button>}
    {partial && <Link to={`/products/${partial}`}>{q("openProduct")}</Link>}
    {result ? <Container><Text role="status">{q("success", { title: result.title })}</Text><div className="mt-4 flex gap-3"><Button asChild variant="secondary"><Link to={`/products/${result.id}`}>{q("openProduct")}</Link></Button><Button onClick={reset}>{q("addAnother")}</Button></div></Container> : settings && <fieldset disabled={blocked || loading || !!missing} className="flex min-w-0 flex-col gap-4">
      <Container>
        <Text>{q("summary", { warehouse: name(settings.locations, book.variants[0].stock[0].location_id), channel: name(settings.channels, book.sales_channel_id), profile: name(settings.profiles, book.shipping_profile_id) })}</Text>
        <Button variant="secondary" className="my-3" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>{q("changeSettings")}</Button>
        {showSettings && <div className="grid gap-4 md:grid-cols-3">
          {field("warehouse", q("warehouse"), select("warehouse", settings.locations, book.variants[0].stock[0].location_id, (id) => change("variants", book.variants.map((v) => ({ ...v, stock: [{ ...v.stock[0], location_id: id }, ...v.stock.slice(1)] })))))}
          {fieldError("variants.0.stock.0.location_id")}
          {field("sales_channel_id", q("channel"), select("sales_channel_id", settings.channels, book.sales_channel_id, (v) => change("sales_channel_id", v)))}
          {field("shipping_profile_id", q("profile"), select("shipping_profile_id", settings.profiles, book.shipping_profile_id, (v) => change("shipping_profile_id", v)))}
          <div className="md:col-span-3"><Text>{q("defaultsHint")}</Text><Button variant="secondary" onClick={saveDefaults}>{q("saveDefaults")}</Button></div>
        </div>}
        {warnings.map((key) => <Text key={key} role="status" className="mt-2 text-ui-fg-error">{q(key)}</Text>)}
        <Text className="mt-2">{q("checkoutHint")}</Text><div className="flex flex-wrap gap-4"><Link to="/settings/locations">{q("openWarehouses")}</Link><Link to="/settings/shipping-profiles">{q("openShipping")}</Link></div>
      </Container>
      <Container className="flex flex-col gap-4"><Heading level="h2">{q("details")}</Heading>
        {field("title", q("titleField"), input("title", book.title, (v) => change("title", v)))}
        {field("description", q("description"), <Textarea id="description" value={book.description} onChange={(e) => change("description", e.target.value)} />)}
        <div className="grid gap-4 md:grid-cols-2">
          {field("brand_id", q("brand"), select("brand_id", settings.brands, book.brand_id, (v) => change("brand_id", v), true))}
          {field("collection_id", q("collection"), select("collection_id", settings.collections, book.collection_id, (v) => change("collection_id", v), true))}
        </div>
        <fieldset><legend>{q("categories")}</legend><div className="flex flex-wrap gap-4">{settings.categories.length ? settings.categories.map((c) => <label key={c.id} className="flex items-center gap-2"><input type="checkbox" checked={book.category_ids.includes(c.id)} onChange={(e) => change("category_ids", e.target.checked ? [...book.category_ids, c.id] : book.category_ids.filter((id) => id !== c.id))} />{c.name}</label>) : <Text>{q("emptyList")}</Text>}</div></fieldset>
      </Container>
      <Container onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!blocked) void upload(Array.from(e.dataTransfer.files)) }}>
        <Heading level="h2">{q("images")}</Heading><Text>{q("imageHint")}</Text>{fieldError("images")}
        <input ref={filesInput} className="hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label={q("chooseImages")} onChange={(e) => { void upload(Array.from(e.target.files || [])); e.target.value = "" }} />
        <Button className="my-3" variant="secondary" onClick={() => filesInput.current?.click()}>{q("chooseImages")}</Button>
        {uploading && <Text role="status">{q("uploading")}</Text>}
        <div className="flex flex-wrap gap-3">{book.images.map((url, i) => <div key={`${url}-${i}`} className="flex w-36 flex-col gap-2"><img src={url} alt={q("imageAlt", { number: i + 1 })} className="h-40 w-full rounded object-contain" /><Button variant="secondary" onClick={() => change("images", [url, ...book.images.filter((_, j) => j !== i)])}>{q(i ? "makeCover" : "cover")}</Button><Button variant="secondary" onClick={() => change("images", book.images.filter((_, j) => j !== i))}>{q("removeImage", { number: i + 1 })}</Button></div>)}</div>
      </Container>
      <Container className="min-w-0"><Heading level="h2">{q("variants")}</Heading><Text>{q("variantHint")}</Text>
        <div className="my-3 flex flex-wrap items-end gap-3">{field("common-binding", q("commonBinding"), <Input id="common-binding" value={commonBinding} onChange={(e) => setCommonBinding(e.target.value)} />)}<Button variant="secondary" onClick={() => change("variants", book.variants.map((v) => ({ ...v, binding: commonBinding })))}>{q("applyBinding")}</Button></div>
        <div className="overflow-x-auto" role="region" aria-label={q("variants")} tabIndex={0}><table className="w-full text-start text-sm"><thead><tr>{["size", "binding", "price", "sku", "quantity"].map((key) => <th scope="col" className="p-2 text-start" key={key}>{q(key, { currency: book.currency_code.toUpperCase() })}</th>)}<th><span className="sr-only">{t("actions.delete")}</span></th></tr></thead>
          <tbody>{book.variants.map((v, i) => <tr key={i} className="border-t">
            <td className="min-w-28 p-2">{field(`variants.${i}.size`, q("size"), input(`variants.${i}.size`, v.size, (size) => variant(i, { size })))}</td>
            <td className="min-w-28 p-2">{field(`variants.${i}.binding`, q("binding"), input(`variants.${i}.binding`, v.binding, (binding) => variant(i, { binding })))}</td>
            <td className="min-w-28 p-2">{field(`variants.${i}.price`, q("price", { currency: book.currency_code.toUpperCase() }), input(`variants.${i}.price`, v.price, (price) => variant(i, { price: price === "" ? NaN : Number(price) }), true))}</td>
            <td className="min-w-48 p-2">{field(`variants.${i}.sku`, q("sku"), input(`variants.${i}.sku`, v.sku, (sku) => variant(i, { sku })))}</td>
            <td className="min-w-48 p-2"><div className="flex flex-col gap-2">{v.stock.map((s, j) => <div key={j}>
              {split && field(`variants.${i}.stock.${j}.location_id`, q("stockWarehouse", { number: j + 1 }), select(`variants.${i}.stock.${j}.location_id`, settings.locations, s.location_id, (location_id) => variant(i, { stock: v.stock.map((x, n) => n === j ? { ...x, location_id } : x) })))}
              {field(`variants.${i}.stock.${j}.quantity`, q("quantity"), input(`variants.${i}.stock.${j}.quantity`, s.quantity, (quantity) => variant(i, { stock: v.stock.map((x, n) => n === j ? { ...x, quantity: quantity === "" ? NaN : Number(quantity) } : x) }), true))}
              {split && j > 0 && <Button variant="secondary" onClick={() => variant(i, { stock: v.stock.filter((_, n) => n !== j) })}>{q("removeWarehouse", { number: j + 1 })}</Button>}
            </div>)}{fieldError(`variants.${i}.stock`)}{split && <Button variant="secondary" onClick={() => variant(i, { stock: [...v.stock, { location_id: "", quantity: 0 }] })}>{q("addWarehouse")}</Button>}</div></td>
            <td className="p-2"><Button variant="secondary" disabled={book.variants.length === 1} onClick={() => change("variants", book.variants.filter((_, j) => j !== i))}>{q("removeVariant", { number: i + 1 })}</Button></td>
          </tr>)}</tbody></table></div>
        <Button className="mt-3" variant="secondary" onClick={() => { const v = freshVariant(); v.binding = commonBinding; v.stock[0].location_id = book.variants[0].stock[0].location_id; change("variants", [...book.variants, v]) }}>{q("addVariant")}</Button>
      </Container>
      <Container><details><summary className="cursor-pointer">{q("advanced")}</summary><div className="mt-4 flex flex-col gap-4">
        {field("handle", q("handle"), input("handle", book.handle, (v) => change("handle", v)))}
        {field("currency_code", q("currency"), select("currency_code", settings.currencies.map((id) => ({ id, name: id.toUpperCase() })), book.currency_code, (v) => change("currency_code", v)))}
        <label className="flex items-center gap-2"><input type="checkbox" checked={book.manage_inventory} onChange={(e) => change("manage_inventory", e.target.checked)} />{q("manageInventory")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={book.allow_backorder} onChange={(e) => change("allow_backorder", e.target.checked)} />{q("backorder")}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={split} onChange={(e) => { setSplit(e.target.checked); if (!e.target.checked) change("variants", book.variants.map((v) => ({ ...v, stock: [v.stock[0]] }))) }} />{q("splitStock")}</label>
      </div></details></Container>
      <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => save("draft")}>{q(busy ? "saving" : "saveDraft")}</Button><Button onClick={() => save("published")}>{q(busy ? "saving" : "publish")}</Button></div>
    </fieldset>}
  </div>
}
export default QuickOperations
// Keep the menu entry visible but inactive; direct URL access remains available.
export const config = defineRouteConfig({ label: "quickOperations.menu", translationNs: "translation", icon: QuickOperationsMenuIcon, rank: 80 })
