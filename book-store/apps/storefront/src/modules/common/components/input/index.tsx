import { Label } from "@modules/common/components/ui"
import React, { useEffect, useId, useImperativeHandle, useState } from "react"

import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"

type InputProps = Omit<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  "placeholder"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
  error?: string | null
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { type, name, label, errors: _errors, touched: _touched, required, topLabel, error, onInvalid, onInput, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const generatedId = useId()
    const inputId = props.id || `${name}-${generatedId}`
    const errorId = `${inputId}-error`
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)
    const [nativeError, setNativeError] = useState("")
    const displayedError = error || nativeError
    const describedBy = [ariaDescribedBy, displayedError ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined

    useEffect(() => {
      if (type === "password" && showPassword) {
        setInputType("text")
      }

      if (type === "password" && !showPassword) {
        setInputType("password")
      }
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    return (
      <div className="flex flex-col w-full">
        {topLabel && (
          <Label htmlFor={inputId} className="mb-2 txt-compact-medium-plus">{topLabel}</Label>
        )}
        <div className="flex relative z-0 w-full txt-compact-medium">
          <input
            type={inputType}
            name={name}
            id={inputId}
            placeholder=" "
            required={required}
            aria-invalid={displayedError ? true : ariaInvalid}
            aria-describedby={describedBy}
            onInvalid={(event) => {
              onInvalid?.(event)
              setNativeError(event.currentTarget.validationMessage)
            }}
            onInput={(event) => {
              onInput?.(event)
              setNativeError(
                event.currentTarget.validity.valid
                  ? ""
                  : event.currentTarget.validationMessage,
              )
            }}
            className="pt-4 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active border-ui-border-base hover:bg-ui-bg-field-hover"
            {...props}
            ref={inputRef}
          />
          <label
            htmlFor={inputId}
            onClick={() => inputRef.current?.focus()}
            className="flex items-center justify-center mx-3 px-1 transition-all absolute duration-300 top-3 -z-1 origin-0 text-ui-fg-subtle"
          >
            {label}
            {required && <span aria-hidden="true" className="text-rose-500">*</span>}
          </label>
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "הסתרת סיסמה" : "הצגת סיסמה"}
              aria-pressed={showPassword}
              className="text-ui-fg-subtle px-4 focus:outline-none transition-all duration-150 outline-none focus:text-ui-fg-base absolute right-0 top-3"
            >
              <span aria-hidden="true">{showPassword ? <Eye /> : <EyeOff />}</span>
            </button>
          )}
        </div>
        {displayedError && (
          <p id={errorId} role="alert" className="mt-1 text-small-regular text-rose-700">
            {displayedError}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export default Input
