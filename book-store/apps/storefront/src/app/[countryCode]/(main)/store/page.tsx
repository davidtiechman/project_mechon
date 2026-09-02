import { Metadata } from "next"

import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"
import { canonicalMetadata } from "@lib/util/seo"

const storeMetadata: Metadata = {
  title: "חנות הספרים",
  description: "כל ספרי מכון מעשה רוקח במקום אחד.",
}

export async function generateMetadata({ params }: Pick<Params, "params">): Promise<Metadata> {
  const { countryCode } = await params
  return { ...storeMetadata, alternates: canonicalMetadata(countryCode, "store") }
}

type StorePageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  search?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<StorePageSearchParams>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page, search } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      optionValueIds={optionValueIds}
      search={typeof search === "string" ? search : ""}
    />
  )
}
