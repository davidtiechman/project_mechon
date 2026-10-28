import { loadQuickSettings } from "../data"

describe("quick book store settings", () => {
  it("loads every page and exposes newly added settings on the next refresh", async () => {
    const locations = Array.from({ length: 205 }, (_, i) => ({ id: `loc_${i}`, name: `Warehouse ${i}`, sales_channels: [], fulfillment_sets: [] }))
    const graph = jest.fn(async ({ entity, pagination }) => {
      const rows = entity === "stock_location" ? locations : entity === "store" ? [{ id: "store_1", supported_currencies: [{ currency_code: "ils" }, { currency_code: "usd" }] }] : entity === "product_collection" ? [{ id: "col_1", title: "Collection" }] : []
      return { data: rows.slice(pagination.skip, pagination.skip + pagination.take), metadata: { count: rows.length } }
    })
    const scope = { resolve: () => ({ graph }) } as any
    const first = await loadQuickSettings(scope)
    expect(first.locations).toHaveLength(205)
    expect(first.currencies).toEqual(["ils", "usd"])
    expect(first.collections).toEqual([{ id: "col_1", name: "Collection" }])
    locations.push({ id: "loc_new", name: "New warehouse", sales_channels: [], fulfillment_sets: [] })
    expect((await loadQuickSettings(scope)).locations).toHaveLength(206)
  })
})
