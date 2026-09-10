"use client"

import { isManual, isStripeLike } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useRef, useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
  beforePayment: () => Promise<boolean>
  onSubmittingChange: (submitting: boolean) => void
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  beforePayment,
  onSubmittingChange,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          beforePayment={beforePayment}
          onSubmittingChange={onSubmittingChange}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} beforePayment={beforePayment} onSubmittingChange={onSubmittingChange} />
      )
    default:
      return <Button disabled>יש לבחור אמצעי תשלום</Button>
  }
}

type ConsentProps = Pick<PaymentButtonProps, "beforePayment" | "onSubmittingChange">

function usePaymentAction({ beforePayment, onSubmittingChange }: ConsentProps, action: () => Promise<void>) {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const locked = useRef(false)
  const handlePayment = async () => {
    if (locked.current) return
    locked.current = true
    setSubmitting(true)
    onSubmittingChange(true)
    setErrorMessage(null)
    try {
      if (await beforePayment()) await action()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "לא ניתן להשלים את ההזמנה כרגע.")
    } finally {
      locked.current = false
      setSubmitting(false)
      onSubmittingChange(false)
    }
  }
  return { submitting, errorMessage, handlePayment }
}

async function completeOrder() {
  await placeOrder()
  // Success navigates to the confirmation page; a returned cart means completion failed.
  throw new Error("לא ניתן להשלים את ההזמנה כרגע. יש לבדוק את פרטי התשלום ולנסות שוב.")
}

const StripePaymentButton = ({
  cart,
  notReady,
  beforePayment,
  onSubmittingChange,
  "data-testid": dataTestId,
}: ConsentProps & {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")
  const session = cart.payment_collection?.payment_sessions?.find((s) => s.status === "pending")
  const { submitting, errorMessage, handlePayment } = usePaymentAction(
    { beforePayment, onSubmittingChange },
    async () => {
      if (!stripe || !elements || !card) throw new Error("יש לבדוק את פרטי התשלום.")
      const { error, paymentIntent } = await stripe.confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card,
          billing_details: {
            name: cart.billing_address?.first_name + " " + cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      const intent = paymentIntent || error?.payment_intent
      if (intent?.status === "requires_capture" || intent?.status === "succeeded") {
        await completeOrder()
      } else {
        throw new Error(error?.message || "לא ניתן לאשר את התשלום. יש לנסות שוב.")
      }
    },
  )
  return (
    <>
      <Button disabled={!stripe || !elements || notReady || submitting} onClick={handlePayment}
        size="large" isLoading={submitting} data-testid={dataTestId}>
        ביצוע ההזמנה
      </Button>
      <ErrorMessage error={errorMessage} data-testid="stripe-payment-error-message" />
    </>
  )
}

const ManualTestPaymentButton = ({ notReady, beforePayment, onSubmittingChange }: ConsentProps & { notReady: boolean }) => {
  const { submitting, errorMessage, handlePayment } = usePaymentAction(
    { beforePayment, onSubmittingChange }, completeOrder,
  )
  return (
    <>
      <Button disabled={notReady || submitting} isLoading={submitting} onClick={handlePayment}
        size="large" data-testid="submit-order-button">
        ביצוע ההזמנה
      </Button>
      <ErrorMessage error={errorMessage} data-testid="manual-payment-error-message" />
    </>
  )
}

export default PaymentButton
