import { Badge } from "@modules/common/components/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">שימו לב:</span> לצורכי בדיקה
      only.
    </Badge>
  )
}

export default PaymentTest
