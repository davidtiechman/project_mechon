import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export type YearCycleMenuProduct = {
  id: string
  title: string
  handle: string
}

export type YearCycleMenuNode = {
  id: string
  name: string
  handle: string
  children: YearCycleMenuNode[]
  products: YearCycleMenuProduct[]
}

export const listCategories = async (query?: Record<string, unknown>) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const next = isDevelopment
    ? undefined
    : {
        ...(await getCacheOptions("categories")),
        revalidate: 60,
      }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: isDevelopment ? "no-store" : "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  const isDevelopment = process.env.NODE_ENV === "development"
  const next = isDevelopment
    ? undefined
    : { ...(await getCacheOptions("categories")), revalidate: 60 }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next,
        cache: isDevelopment ? "no-store" : "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}

export const getYearCycleMenu = async (): Promise<YearCycleMenuNode | null> => {
  const categories = await listCategories({ limit: 100 })
  const root = categories.find(
    (category) =>
      category.name.trim() === "מעגל השנה" || category.handle === "מעגל-השנה"
  )

  if (!root) {
    return null
  }

  const buildNode = (
    category: HttpTypes.StoreProductCategory
  ): YearCycleMenuNode => ({
    id: category.id,
    name: category.name,
    handle: category.handle,
    children: categories
      .filter((candidate) => candidate.parent_category_id === category.id)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map(buildNode),
    products: (category.products || [])
      .filter((product) => Boolean(product.handle))
      .map((product) => ({
        id: product.id,
        title: product.title,
        handle: product.handle!,
      })),
  })

  return buildNode(root)
}
