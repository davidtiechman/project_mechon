import { Badge, Button, Container, Heading, Input, Label, Switch, Text, toast } from "@medusajs/ui"
import { FormEvent, useEffect, useState } from "react"
import { contentApi } from "../../../lib/content-api"

type Policy = { enabled: boolean; amount_per_installment: number; max_installments: number }

const example = (policy: Policy, total: number) => {
  if (!policy.enabled || !(policy.amount_per_installment > 0)) return 1
  return Math.max(1, Math.min(policy.max_installments || 1, 36, Math.floor(total / policy.amount_per_installment)))
}

const InstallmentsPage = () => {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [amount, setAmount] = useState("")
  const [max, setMax] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    contentApi<{ policy: Policy }>("/installments")
      .then(({ policy }) => {
        setPolicy(policy)
        setEnabled(policy.enabled)
        setAmount(String(policy.amount_per_installment))
        setMax(String(policy.max_installments))
      })
      .catch(() => toast.error("לא ניתן לטעון את הגדרות התשלומים"))
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await contentApi<{ policy: Policy }>("/installments", {
        method: "POST",
        body: JSON.stringify({ enabled, amount_per_installment: Number(amount), max_installments: Number(max) }),
      })
      setPolicy(result.policy)
      toast.success("הגדרות התשלומים נשמרו")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה")
    } finally {
      setSaving(false)
    }
  }

  const draft: Policy = { enabled, amount_per_installment: Number(amount), max_installments: Number(max) }

  return <div className="flex flex-col gap-3" dir="rtl">
    <Container className="p-6">
      <div className="flex items-center gap-2">
        <Heading level="h1">תשלומים בכרטיס אשראי</Heading>
        {policy && <Badge color={policy.enabled ? "green" : "grey"}>{policy.enabled ? "פעיל" : "כבוי"}</Badge>}
      </div>
      <Text className="mt-2 text-ui-fg-subtle">
        הלקוח יכול לחלק את ההזמנה לתשלום אחד על כל סכום מלא שתגדירו, עד המספר המרבי. התשלומים זמינים בכרטיס אשראי בלבד, לא בביט ולא בהעברה.
      </Text>
    </Container>
    <Container className="p-6">
      {!policy ? <Text>טוען…</Text> : <form className="flex max-w-md flex-col gap-5" onSubmit={save}>
        <div className="flex items-center gap-3">
          <Switch id="installments-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="installments-enabled">לאפשר תשלומים באתר</Label>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="installments-amount">תשלום אחד על כל (₪)</Label>
          <Input id="installments-amount" type="number" min={5} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Text size="small" className="text-ui-fg-subtle">לפחות 5 ₪, לפי מגבלת נדרים פלוס.</Text>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="installments-max">מספר תשלומים מרבי</Label>
          <Input id="installments-max" type="number" min={2} max={36} step={1} required value={max} onChange={(e) => setMax(e.target.value)} />
          <Text size="small" className="text-ui-fg-subtle">בין 2 ל־36. אל תגדירו יותר ממה שמוגדר למוסד בנדרים פלוס.</Text>
        </div>
        <div className="rounded-md bg-ui-bg-subtle p-3">
          <Text weight="plus">דוגמאות לפי ההגדרות שבטופס:</Text>
          {[40, 100, 260, 1000].map((total) => <Text size="small" key={total}>
            הזמנה של {total} ₪ ← {example(draft, total) > 1 ? `עד ${example(draft, total)} תשלומים` : "תשלום אחד בלבד"}
          </Text>)}
        </div>
        <div><Button type="submit" isLoading={saving}>שמירה</Button></div>
      </form>}
    </Container>
  </div>
}

export default InstallmentsPage
