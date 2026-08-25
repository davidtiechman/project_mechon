import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <fieldset className="flex flex-col gap-y-3">
      <legend className="text-sm">בחירת {title}</legend>
      <div
        className="flex flex-wrap justify-between gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          return (
            <label
              key={v}
              className={clx(
                "relative border-ui-border-base bg-ui-bg-subtle border text-small-regular min-h-10 rounded-rounded p-2 flex flex-1 cursor-pointer items-center justify-center focus-within:ring-2 focus-within:ring-offset-2",
                {
                  "border-ui-border-interactive": v === current,
                  "hover:shadow-elevation-card-rest transition-shadow ease-in-out duration-150":
                    v !== current,
                }
              )}
              data-testid="option-button"
            >
              <input
                className="sr-only"
                type="radio"
                name={`product-option-${option.id}`}
                value={v}
                checked={v === current}
                disabled={disabled}
                onChange={() => updateOption(option.id, v)}
              />
              <span>{v}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default OptionSelect
