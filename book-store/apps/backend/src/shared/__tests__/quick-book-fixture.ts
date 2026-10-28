import type { QuickBook } from "../quick-book"
export const fixture = (): QuickBook => ({ request_id: "123e4567-e89b-42d3-a456-426614174000", title: "ספר בדיקה", description: "תוכן מקורי", handle: "test-book", status: "published", images: ["https://example.test/cover.png"], brand_id: "brand_1", category_ids: ["cat_1"], collection_id: "col_1", sales_channel_id: "sc_1", shipping_profile_id: "sp_1", currency_code: "ils", manage_inventory: true, allow_backorder: false, variants: [
  { size: "גדול", binding: "קשה", sku: "BOOK-A", price: 49.9, stock: [{ location_id: "loc_1", quantity: 0 }] },
  { size: "קטן", binding: "קשה", sku: "BOOK-B", price: 25, stock: [{ location_id: "loc_1", quantity: 12 }, { location_id: "loc_2", quantity: 3 }] },
] })
