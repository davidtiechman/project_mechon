import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

const LineItemOptions = ({
  variant,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  const isDefaultVariant =
    !variant || variant.title?.toLowerCase() === "default variant"

  if (isDefaultVariant) {
    return null
  }

  const optionValues = variant.options
    ?.map((value) =>
      value.option?.title
        ? `${value.option.title}: ${value.value}`
        : value.value,
    )
    .filter(Boolean)
    .join(" · ")

  return (
    <Text
      data-testid={dataTestid}
      data-value={dataValue}
      className="inline-block txt-medium text-ui-fg-subtle w-full overflow-hidden text-ellipsis"
    >
      {optionValues || `גרסה: ${variant.title}`}
    </Text>
  )
}

export default LineItemOptions
