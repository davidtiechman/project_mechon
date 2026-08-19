import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { privatePageRobots } from "@lib/util/seo"

export const metadata: Metadata = {
  robots: privatePageRobots,
  title: "סל הקניות",
  description: "צפייה בסל הקניות",
}

export default async function Cart() {
  const cart = await retrieveCart().catch(() => {
    return notFound()
  })

  const customer = await retrieveCustomer()

  return <CartTemplate cart={cart} customer={customer} />
}
