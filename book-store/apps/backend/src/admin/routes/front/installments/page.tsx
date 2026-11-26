import { Badge, Button, Checkbox, Container, Heading, Input, Label, Switch, Text, toast } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { contentApi } from "../../../lib/content-api"

type Policy = { enabled: boolean; amount_per_installment: number; max_installments: number }
type Wallets = { google_pay: boolean; apple_pay: boolean; bit: boolean; digital_transfer: boolean }

const walletOptions: Array<{ key: keyof Wallets; label: string; note: string }> = [
  { key: "google_pay", label: "Google Pay", note: "מוצג בדפדפנים ובמכשירים שתומכים בו." },
  { key: "apple_pay", label: "Apple Pay", note: "רק אחרי אישור הדומיין בנדרים פלוס." },
  { key: "bit", label: "ביט", note: "רק אחרי שביט הופעל במוסד בנדרים פלוס." },
  { key: "digital_transfer", label: "העברה בנקאית בקליק", note: "רק אחרי שהשירות הופעל במוסד בנדרים פלוס." },
]

const example = (policy: Policy, total: number) => {
  if (!policy.enabled || !(policy.amount_per_installment > 0)) return 1
  return Math.max(1, Math.min(policy.max_installments || 1, 36, Math.floor(total / policy.amount_per_installment)))
}

const PaymentOptionsPage = () => {
  const [loaded, setLoaded] = useState<{ policy: Policy; wallets: Wallets } | null>(null)
  const [amount, setAmount] = useState("")
  const [max, setMax] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [wallets, setWallets] = useState<Wallets>({ google_pay: true, apple_pay: false, bit: false, digital_transfer: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    contentApi<{ policy: Policy; wallets: Wallets }>("/installments")
      .then((data) => {
        setLoaded(data)
        setEnabled(data.policy.enabled)
        setAmount(String(data.policy.amount_per_installment))
        setMax(String(data.policy.max_installments))
        setWallets(data.wallets)
      })
      .catch(() => toast.error("לא ניתן לטעון את הגדרות התשלום"))
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await contentApi<{ policy: Policy; wallets: Wallets }>("/installments", {
        method: "POST",
        body: JSON.stringify({ enabled, amount_per_installment: Number(amount), max_installments: Number(max), wallets }),
      })
      setLoaded(result)
      toast.success("הגדרות התשלום נשמרו")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה")
    } finally {
      setSaving(false)
    }
  }

  const draft: Policy = { enabled, amount_per_installment: Number(amount), max_installments: Number(max) }

  return <div className="flex flex-col gap-3" dir="rtl">
    <Container className="p-6">
      <Heading level="h1">אמצעי תשלום ותשלומים</Heading>
      <Text className="mt-2 text-ui-fg-subtle">מה הלקוח יכול לבחור בקופה. ההגדרות קובעות גם מה מוצג בחלון התשלום של נדרים פלוס.</Text>
    </Container>
    {!loaded ? <Container className="p-6"><Text>טוען…</Text></Container> : <form className="flex flex-col gap-3" onSubmit={save}>
      <Container className="flex flex-col gap-4 p-6">
        <Heading level="h2">תשלום אחד</Heading>
        <Text className="text-ui-fg-subtle">כרטיס אשראי זמין תמיד. סמנו אמצעים נוספים רק אחרי שהם פעילים אצלכם בנדרים פלוס.</Text>
        {walletOptions.map((option) => <div key={option.key} className="flex items-start gap-3">
          <Checkbox id={`wallet-${option.key}`} checked={wallets[option.key]}
            onCheckedChange={(checked) => setWallets((current) => ({ ...current, [option.key]: checked === true }))} />
          <div className="flex flex-col">
            <Label htmlFor={`wallet-${option.key}`}>{option.label}</Label>
            <Text size="small" className="text-ui-fg-subtle">{option.note}</Text>
          </div>
        </div>)}
      </Container>
      <Container className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-2">
          <Heading level="h2">חלוקה לתשלומים</Heading>
          <Badge color={loaded.policy.enabled ? "green" : "grey"}>{loaded.policy.enabled ? "פעיל" : "כבוי"}</Badge>
        </div>
        <Text className="text-ui-fg-subtle">בכרטיס אשראי בלבד. הלקוח יכול לחלק את ההזמנה לתשלום אחד על כל סכום מלא שתגדירו, עד המספר המרבי.</Text>
        <div className="flex items-center gap-3">
          <Switch id="installments-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="installments-enabled">לאפשר חלוקה לתשלומים</Label>
        </div>
        <div className="flex max-w-md flex-col gap-1">
          <Label htmlFor="installments-amount">תשלום אחד על כל (₪)</Label>
          <Input id="installments-amount" type="number" min={10} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Text size="small" className="text-ui-fg-subtle">לפחות 10 ₪, לפי מגבלת נדרים פלוס.</Text>
        </div>
        <div className="flex max-w-md flex-col gap-1">
          <Label htmlFor="installments-max">מספר תשלומים מרבי</Label>
          <Input id="installments-max" type="number" min={2} max={36} step={1} required value={max} onChange={(e) => setMax(e.target.value)} />
          <Text size="small" className="text-ui-fg-subtle">בין 2 ל־36.</Text>
        </div>
        <div className="max-w-md rounded-md bg-ui-bg-subtle p-3">
          <Text weight="plus">דוגמאות לפי ההגדרות שבטופס:</Text>
          {[40, 100, 260, 1000].map((total) => <Text size="small" key={total}>
            הזמנה של {total} ₪ ← {example(draft, total) > 1 ? `עד ${example(draft, total)} תשלומים` : "תשלום אחד בלבד"}
          </Text>)}
        </div>
      </Container>
      <div><Button type="submit" isLoading={saving}>שמירה</Button></div>
    </form>}
  </div>
}

export default PaymentOptionsPage
