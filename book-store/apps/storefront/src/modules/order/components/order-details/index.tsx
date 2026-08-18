import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const statusLabels: Record<string, string> = {
    not_fulfilled: "טרם טופלה",
    partially_fulfilled: "טופלה חלקית",
    fulfilled: "טופלה",
    partially_shipped: "נשלחה חלקית",
    shipped: "נשלחה",
    partially_delivered: "נמסרה חלקית",
    delivered: "נמסרה",
    partially_returned: "הוחזרה חלקית",
    returned: "הוחזרה",
    canceled: "בוטלה",
    requires_action: "נדרשת פעולה",
    awaiting: "ממתין לתשלום",
    authorized: "התשלום אושר",
    partially_authorized: "התשלום אושר חלקית",
    captured: "שולם",
    partially_captured: "שולם חלקית",
    refunded: "הוחזר",
    partially_refunded: "הוחזר חלקית",
  }

  const formatStatus = (status: string) => {
    return statusLabels[status] ?? status.split("_").join(" ")
  }

  return (
    <div>
      <Text>
        פרטי אישור ההזמנה נשלחו לכתובת{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <Text className="mt-2">
        תאריך ההזמנה:{" "}
        <span data-testid="order-date">
          {new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(
            new Date(order.created_at)
          )}
        </span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        מספר הזמנה: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <Text>
              סטטוס הזמנה:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              סטטוס תשלום:{" "}
              <span
                className="text-ui-fg-subtle "
                data-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
