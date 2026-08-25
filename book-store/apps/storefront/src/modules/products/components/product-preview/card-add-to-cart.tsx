"use client"

import { addToCart } from "@lib/data/cart"
import { ShoppingCart, Spinner } from "@medusajs/icons"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

export default function CardAddToCart({
  variantId,
  productHandle,
  disabled,
}: {
  variantId?: string
  productHandle: string
  disabled?: boolean
}) {
  const { countryCode } = useParams<{ countryCode: string }>()
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const handleClick = async () => {
    if (!variantId) {
      router.push(`/${countryCode}/products/${productHandle}`)
      return
    }

    setIsAdding(true)
    try {
      await addToCart({ variantId, quantity: 1, countryCode })
      setAdded(true)
      router.refresh()
      window.setTimeout(() => setAdded(false), 1800)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <>
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isAdding}
      aria-label={variantId ? `הוספת המוצר לסל` : "מעבר לבחירת אפשרויות המוצר"}
      className="absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#d8c7b8] bg-[#f3ece4] px-3 text-sm font-semibold text-[#4a2d21] shadow-lg transition-[width,background-color] duration-300 hover:bg-[#eadfd5] focus-visible:w-[132px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a7130] focus-visible:ring-offset-2 group-hover/card:w-[132px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover/card:ml-2 group-hover/card:w-auto group-hover/card:opacity-100 group-focus-within/card:ml-2 group-focus-within/card:w-auto group-focus-within/card:opacity-100">
        {added ? "נוסף לסל" : "הוספה לסל"}
      </span>
      <span className="flex shrink-0 items-center justify-center" aria-hidden="true">
        {isAdding ? <Spinner className="animate-spin" /> : <ShoppingCart />}
      </span>
    </button>
    <span className="sr-only" role="status" aria-live="polite">
      {added ? "המוצר נוסף לסל" : ""}
    </span>
    </>
  )
}
