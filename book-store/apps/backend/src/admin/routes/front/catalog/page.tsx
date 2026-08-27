import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { contentApi, uploadContentFile } from "../../../lib/content-api"

type Catalog = { id: string; file_key: string; file_url: string; file_name: string; updated_at: string; active: boolean }

const CatalogPage = () => {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    contentApi<{ catalog: Catalog | null }>("/catalog")
      .then((data) => setCatalog(data.catalog))
      .catch(() => toast.error("לא ניתן לטעון את פרטי הקטלוג"))
      .finally(() => setLoading(false))
  }, [])

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("ניתן להעלות קובץ PDF בלבד")
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadContentFile(file)
      const result = await contentApi<{ catalog: Catalog }>("/catalog", {
        method: "POST",
        body: JSON.stringify({ file_key: uploaded.id, file_url: uploaded.url, file_name: file.name, mime_type: file.type }),
      })
      setCatalog(result.catalog)
      toast.success("הקטלוג הועלה והופעל בהצלחה")
    } catch {
      toast.error("העלאת הקטלוג נכשלה")
    } finally {
      setUploading(false)
    }
  }

  const deactivate = async () => {
    try {
      await contentApi("/catalog", { method: "DELETE" })
      setCatalog(null)
      toast.success("הקטלוג הוסר מהאתר")
    } catch {
      toast.error("לא ניתן להסיר את הקטלוג")
    }
  }

  return <div className="flex flex-col gap-3" dir="rtl">
    <Container className="p-6">
      <Heading level="h1">קטלוג</Heading>
      <Text className="mt-2 text-ui-fg-subtle">ניהול קטלוג ה־PDF שמוצג באתר</Text>
    </Container>
    <Container className="p-6">
      {loading ? <Text>טוען…</Text> : catalog ? <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2"><Badge color="green">פעיל</Badge><Heading level="h2">{catalog.file_name}</Heading></div>
        <Text className="text-ui-fg-subtle">עודכן: {new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(catalog.updated_at))}</Text>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><a href={catalog.file_url} target="_blank" rel="noreferrer">צפייה בקטלוג</a></Button>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? "מעלה…" : "החלפת קטלוג"}</Button>
          <Button variant="danger" onClick={deactivate} disabled={uploading}>הסרה מהאתר</Button>
        </div>
      </div> : <div className="flex flex-col items-start gap-4">
        <div><Heading level="h2">אין כרגע קטלוג פעיל</Heading><Text className="mt-1 text-ui-fg-subtle">הכפתור באתר מוצג במצב “יעלה בקרוב” ואינו מוריד קובץ.</Text></div>
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? "מעלה…" : "העלאת קטלוג PDF"}</Button>
      </div>}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={upload} />
    </Container>
  </div>
}

export default CatalogPage
