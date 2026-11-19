"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const isDevelopment = process.env.NODE_ENV === "development"
  const next = isDevelopment ? undefined : await getCacheOptions("payment_providers")

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
        cache: isDevelopment ? "no-store" : "force-cache",
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.filter((provider) =>
        // The manual provider authorizes without collecting money. It is for local tests only.
        process.env.NODE_ENV !== "production" || provider.id !== "pp_system_default"
      ).sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch(() => {
      return null
    })
}
