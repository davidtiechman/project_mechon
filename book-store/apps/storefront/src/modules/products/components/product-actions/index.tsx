"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [isBuying, setIsBuying] = useState(false)
  const [isNavigating, startNavigation] = useTransition()
  const [cartError, setCartError] = useState("")
  const adding = useRef(false)
  const [cartAnnouncement, setCartAnnouncement] = useState("")
  const countryCode = useParams().countryCode as string

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    if (product.variants?.length === 1) {
      const variantOptions = optionsAsKeymap(product.variants[0].options)
      setOptions(variantOptions ?? {})
    }
  }, [product.variants])

  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return
    }

    return product.variants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product.variants?.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [product.variants, options])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString())
  }, [selectedVariant, isValidVariant, pathname, router, searchParams])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant])

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async (checkout = false) => {
    if (!selectedVariant?.id || adding.current || isNavigating) return
    adding.current = true
    setIsAdding(true)
    setIsBuying(checkout)
    setCartError("")
    try {
      await addToCart({ variantId: selectedVariant.id, quantity: 1, countryCode })
      setCartAnnouncement(`${product.title} נוסף לסל`)
      if (checkout) startNavigation(() => router.push(`/${countryCode}/checkout`))
    } catch {
      setCartError("לא ניתן להוסיף את הספר כרגע. נסו שוב.")
    } finally {
      adding.current = false
      setIsAdding(false)
      setIsBuying(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {(product.variants?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        <ProductPrice product={product} variant={selectedVariant} />

        <Button onClick={() => handleAddToCart(true)}
          disabled={!inStock || !selectedVariant || !!disabled || isAdding || isNavigating || !isValidVariant}
          variant="primary" className="w-full h-11" isLoading={isBuying || isNavigating} data-testid="buy-now-button">
          קנייה עכשיו
        </Button>
        <Button
          onClick={() => handleAddToCart()}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            isNavigating ||
            !isValidVariant
          }
          variant="secondary"
          className="w-full h-10"
          isLoading={isAdding && !isBuying}
          data-testid="add-product-button"
        >
          {!selectedVariant || !isValidVariant
            ? "יש לבחור אפשרות"
            : !inStock || !isValidVariant
            ? "אזל מהמלאי"
            : "הוספה לסל"}
        </Button>
        {cartError && <p role="alert" className="text-sm text-rose-700">{cartError}</p>}
        <p className="sr-only" role="status" aria-live="polite">
          {cartAnnouncement}
        </p>
        <MobileActions
          product={product}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          handleAddToCart={() => handleAddToCart()}
          handleBuyNow={() => handleAddToCart(true)}
          isAdding={isAdding && !isBuying}
          isBuying={isBuying || isNavigating}
          show={!inView}
          optionsDisabled={!!disabled || isAdding || isNavigating}
        />
      </div>
    </>
  )
}
