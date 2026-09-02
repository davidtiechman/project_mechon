import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createCustomerAddressesWorkflow,
  updateCustomerAddressesWorkflow,
  updateCustomersWorkflow,
} from "@medusajs/medusa/core-flows"

type Body = {
  source_type: "cart" | "order"
  source_id: string
}

type Address = {
  id?: string
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  postal_code?: string | null
  province?: string | null
  country_code?: string | null
  phone?: string | null
  metadata?: Record<string, unknown> | null
  is_default_shipping?: boolean
  is_default_billing?: boolean
}

const normalize = (value?: string | null) =>
  String(value || "").trim().toLocaleLowerCase()

const addressFingerprint = (address: Address) =>
  [
    address.address_1,
    address.address_2,
    address.city,
    address.postal_code,
    address.province,
    address.country_code,
  ]
    .map(normalize)
    .join("|")

export const POST = async (
  req: AuthenticatedMedusaRequest<Body>,
  res: MedusaResponse
) => {
  const customerId = req.auth_context.actor_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "The customer is not authenticated."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: customers }, { data: sources }] = await Promise.all([
    query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "phone", "addresses.*"],
      filters: { id: customerId },
    }),
    query.graph({
      entity: req.body.source_type,
      fields: ["id", "email", "shipping_address.*", "billing_address.*"],
      filters: { id: req.body.source_id },
    }),
  ])

  const customer = customers[0] as
    | ({ id: string; email: string; addresses?: Address[] } & Address)
    | undefined
  const source = sources[0] as
    | {
        id: string
        email?: string | null
        shipping_address?: Address | null
        billing_address?: Address | null
      }
    | undefined

  if (!customer || !source) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Checkout details were not found.")
  }

  if (!source.email || normalize(source.email) !== normalize(customer.email)) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "The checkout email does not match the authenticated customer."
    )
  }

  const shipping = source.shipping_address || undefined
  const billing = source.billing_address || undefined
  const profile = {
    ...(shipping?.first_name ? { first_name: shipping.first_name } : {}),
    ...(shipping?.last_name ? { last_name: shipping.last_name } : {}),
    ...(shipping?.phone ? { phone: shipping.phone } : {}),
  }
  await updateCustomersWorkflow(req.scope).run({
    input: { selector: { id: customer.id }, update: profile },
  })

  const candidates = new Map<
    string,
    { address: Address; shipping: boolean; billing: boolean }
  >()
  for (const [address, kind] of [
    [shipping, "shipping"],
    [billing, "billing"],
  ] as const) {
    if (!address?.address_1 || !address.country_code) continue
    const fingerprint = addressFingerprint(address)
    const existing = candidates.get(fingerprint)
    candidates.set(fingerprint, {
      address,
      shipping: existing?.shipping || kind === "shipping",
      billing: existing?.billing || kind === "billing",
    })
  }

  const savedAddresses = (customer.addresses || []) as Address[]
  let created = 0
  let reused = 0

  for (const candidate of candidates.values()) {
    const existing = savedAddresses.find(
      (address) => addressFingerprint(address) === addressFingerprint(candidate.address)
    )
    const flags = {
      is_default_shipping: candidate.shipping,
      is_default_billing: candidate.billing,
    }

    if (existing?.id) {
      await updateCustomerAddressesWorkflow(req.scope).run({
        input: {
          selector: { id: existing.id },
          update: {
          first_name: candidate.address.first_name || undefined,
          last_name: candidate.address.last_name || undefined,
          company: candidate.address.company || undefined,
          address_1: candidate.address.address_1 || "",
          address_2: candidate.address.address_2 || undefined,
          city: candidate.address.city || undefined,
          postal_code: candidate.address.postal_code || undefined,
          province: candidate.address.province || undefined,
          country_code: candidate.address.country_code || "",
          phone: candidate.address.phone || undefined,
          metadata: candidate.address.metadata || undefined,
            ...flags,
          },
        },
      })
      reused += 1
      continue
    }

    await createCustomerAddressesWorkflow(req.scope).run({
      input: {
        addresses: [{
          customer_id: customer.id,
          first_name: candidate.address.first_name || undefined,
          last_name: candidate.address.last_name || undefined,
          company: candidate.address.company || undefined,
          address_1: candidate.address.address_1 || "",
          address_2: candidate.address.address_2 || undefined,
          city: candidate.address.city || undefined,
          postal_code: candidate.address.postal_code || undefined,
          province: candidate.address.province || undefined,
          country_code: candidate.address.country_code,
          phone: candidate.address.phone || undefined,
          metadata: candidate.address.metadata || undefined,
          ...flags,
        }],
      },
    })
    created += 1
  }

  res.status(200).json({ success: true, addresses_created: created, addresses_reused: reused })
}
