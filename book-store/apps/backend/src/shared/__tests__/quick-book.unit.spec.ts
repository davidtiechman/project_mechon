import { createInstance } from "i18next"
import { quickBookSchema, shippingWarnings, type QuickSettings } from "../quick-book"
import { productInput, inventoryLevelsInput } from "../../workflows/create-quick-book"
import { quickOperationsEn, quickOperationsHe } from "../../admin/i18n/quick-operations"
import { siteContentEn, siteContentHe } from "../../admin/i18n/content"
import he from "../../admin/i18n/json/he.json"

import { fixture } from "./quick-book-fixture"

describe("quick book input", () => {
  it("maps multiple variants, major-unit prices and explicit inventory links to Medusa", () => {
    const book = quickBookSchema.parse(fixture())
    const product = productInput(book, "prod_new", "hash", [{ id: "inv_1" }, { id: "inv_2" }])
    expect(product.status).toBe("draft")
    expect(product.shipping_profile_id).toBe("sp_1")
    expect(product.sales_channels).toEqual([{ id: "sc_1" }])
    expect(product.category_ids).toEqual(["cat_1"])
    expect(product.collection_id).toBe("col_1")
    expect(product.variants![0].prices).toEqual([{ amount: 49.9, currency_code: "ils" }])
    expect(product.variants![1].inventory_items).toEqual([{ inventory_item_id: "inv_2", required_quantity: 1 }])
    expect(book.variants[0].stock[0].quantity).toBe(0)
    expect(inventoryLevelsInput(book, [{ id: "inv_1" }, { id: "inv_2" }])).toEqual([
      { inventory_item_id: "inv_1", location_id: "loc_1", stocked_quantity: 0 },
      { inventory_item_id: "inv_2", location_id: "loc_1", stocked_quantity: 12 },
      { inventory_item_id: "inv_2", location_id: "loc_2", stocked_quantity: 3 },
    ])
  })
  it("supports a single variant and optional binding", () => {
    const book = fixture(); book.variants = [{ ...book.variants[0], binding: "" }]
    const product = productInput(book, "prod_new", "hash", [{ id: "inv_1" }])
    expect(product.options).toHaveLength(1)
    expect(product.variants![0].options).toEqual({ Size: "גדול" })
    expect(quickBookSchema.safeParse(book).success).toBe(true)
  })
  it.each([-1, 1.5, NaN, Infinity])("rejects invalid stock %s", (quantity) => {
    const book = fixture(); book.variants[0].stock[0].quantity = quantity
    expect(quickBookSchema.safeParse(book).success).toBe(false)
  })
  it("blocks duplicate combinations, SKUs and warehouse entries", () => {
    const book = fixture(); book.variants[1] = { ...book.variants[0], stock: [book.variants[0].stock[0], book.variants[0].stock[0]] }
    const result = quickBookSchema.safeParse(book)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((i) => i.message)).toEqual(expect.arrayContaining(["duplicateOptions", "duplicateSku", "duplicateLocation"]))
  })
  it("requires a cover only when publishing", () => {
    const book = fixture(); book.images = []
    expect(quickBookSchema.safeParse(book).success).toBe(false)
    book.status = "draft"
    expect(quickBookSchema.safeParse(book).success).toBe(true)
  })
  it("detects channel and shipping profile mismatches", () => {
    const settings = { locations: [{ id: "loc_1", sales_channels: [], fulfillment_sets: [] }, { id: "loc_2", sales_channels: [], fulfillment_sets: [] }], shipping: [] } as unknown as QuickSettings
    expect(shippingWarnings(fixture(), settings)).toEqual(expect.arrayContaining(["channelMismatch", "shippingMismatch"]))
  })
})

describe("shared Admin translations", () => {
  it("follows profile-style language changes, direction and English fallback without changing book data", async () => {
    const i18n = createInstance()
    await i18n.init({ lng: "he", fallbackLng: "en", interpolation: { escapeValue: false }, resources: {
      he: { translation: { ...he, siteContent: siteContentHe, quickOperations: quickOperationsHe } },
      en: { translation: { siteContent: siteContentEn, quickOperations: quickOperationsEn } },
    } })
    const book = fixture(), before = JSON.stringify(book)
    expect(i18n.t("quickOperations.menu")).toBe("תפעול מהיר")
    expect(i18n.dir()).toBe("rtl")
    expect(i18n.t("siteContent.menu")).toBe("תוכן האתר")
    await i18n.changeLanguage("en")
    expect(i18n.t("quickOperations.menu")).toBe("Quick operations")
    expect(i18n.dir()).toBe("ltr")
    expect(i18n.t("siteContent.menu")).toBe("Site Content")
    await i18n.changeLanguage("fr")
    expect(i18n.t("quickOperations.title")).toBe("Add a book")
    expect(JSON.stringify(book)).toBe(before)
  })
  it("has complete matching dictionaries and interpolation placeholders", () => {
    expect(Object.keys(quickOperationsHe).sort()).toEqual(Object.keys(quickOperationsEn).sort())
    for (const key of Object.keys(quickOperationsEn) as (keyof typeof quickOperationsEn)[]) {
      expect(quickOperationsHe[key]).toBeTruthy()
      expect(quickOperationsHe[key].match(/{{\w+}}/g)?.sort()).toEqual(quickOperationsEn[key].match(/{{\w+}}/g)?.sort())
    }
  })
})
