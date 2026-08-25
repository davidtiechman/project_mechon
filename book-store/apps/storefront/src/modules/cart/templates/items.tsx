import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Heading, Table } from "@modules/common/components/ui"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items
  return (
    <div>
      <div className="pb-3 flex items-center">
        <Heading level="h1" className="text-[2rem] leading-[2.75rem]">סל הקניות</Heading>
      </div>
      <Table>
        <caption className="sr-only">פריטים בסל הקניות</caption>
        <Table.Header className="border-t-0">
          <Table.Row className="text-ui-fg-subtle txt-medium-plus">
            <Table.HeaderCell scope="col" className="!pr-0 text-right">פריט</Table.HeaderCell>
            <Table.HeaderCell scope="col"><span className="sr-only">פרטי המוצר</span></Table.HeaderCell>
            <Table.HeaderCell scope="col" className="text-right">כמות</Table.HeaderCell>
            <Table.HeaderCell scope="col" className="hidden small:table-cell text-right">
              מחיר
            </Table.HeaderCell>
            <Table.HeaderCell scope="col" className="!pl-0 text-right">
              סה״כ
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items
            ? items
                .sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
                .map((item) => {
                  return (
                    <Item
                      key={item.id}
                      item={item}
                      currencyCode={cart?.currency_code}
                    />
                  )
                })
            : repeat(5).map((i) => {
                return <SkeletonLineItem key={i} />
              })}
        </Table.Body>
      </Table>
    </div>
  )
}

export default ItemsTemplate
