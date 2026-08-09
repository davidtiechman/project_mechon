"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const getProductTagByValue = async (value: string) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const next = isDevelopment
    ? undefined
    : { ...(await getCacheOptions("product-tags")), revalidate: 60 }

  return sdk.client
    .fetch<{ product_tags: HttpTypes.StoreProductTag[] }>("/store/product-tags", {
      query: { value, limit: 100 },
      next,
      cache: isDevelopment ? "no-store" : "force-cache",
    })
    .then(({ product_tags }) =>
      product_tags.find((tag) => tag.value === value)
    )
}
