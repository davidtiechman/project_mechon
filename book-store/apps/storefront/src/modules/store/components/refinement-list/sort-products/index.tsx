"use client"

import FilterRadioGroup from "@modules/common/components/filter-radio-group"

export type SortOptions =
  | "price_asc"
  | "price_desc"
  | "created_at"
  | "created_at_asc"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: string) => void
  "data-testid"?: string
}

const sortOptions = [
  {
    value: "created_at",
    label: "החדשים ביותר",
  },
  {
    value: "created_at_asc",
    label: "הישנים ביותר",
  },
  {
    value: "price_asc",
    label: "מחיר: מהנמוך לגבוה",
  },
  {
    value: "price_desc",
    label: "מחיר: מהגבוה לנמוך",
  },
]

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
}: SortProductsProps) => {
  const handleChange = (value: string) => {
    setQueryParams("sortBy", value as SortOptions)
  }

  return (
    <FilterRadioGroup
      title="מיון לפי"
      items={sortOptions}
      value={sortBy}
      handleChange={handleChange}
      data-testid={dataTestId}
    />
  )
}

export default SortProducts
