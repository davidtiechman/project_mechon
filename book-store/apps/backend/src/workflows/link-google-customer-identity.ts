import { MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  setAuthAppMetadataStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"

type WorkflowInput = {
  auth_identity_id: string
}

type AuthIdentityData = {
  provider_identities?: Array<{
    provider: string
    user_metadata?: Record<string, unknown>
  }>
}[]

const getVerifiedGoogleEmailStep = createStep(
  "get-verified-google-email",
  ({ authIdentities }: { authIdentities: unknown }) => {
    const identities = authIdentities as AuthIdentityData
    const googleIdentity = identities[0]?.provider_identities?.find(
      (identity) => identity.provider === "google"
    )
    const email = googleIdentity?.user_metadata?.email

    if (typeof email !== "string" || !email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Couldn't determine the verified Google identity email."
      )
    }

    return new StepResponse(email.toLowerCase())
  }
)

const validateGoogleCustomerExistsStep = createStep(
  "validate-google-customer-exists",
  ({ customers, email }: { customers: unknown; email: string }) => {
    const customerList = customers as Array<{ id: string }>
    if (!customerList.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No customer found with email ${email}`
      )
    }

    return new StepResponse(customerList[0])
  }
)

export const linkGoogleCustomerIdentityWorkflow = createWorkflow(
  "link-google-customer-identity",
  (input: WorkflowInput) => {
    const { data: authIdentities } = useQueryGraphStep({
      entity: "auth_identity",
      fields: [
        "provider_identities.provider",
        "provider_identities.user_metadata",
      ],
      filters: { id: input.auth_identity_id },
    })

    const email = getVerifiedGoogleEmailStep({ authIdentities })

    const { data: customers } = useQueryGraphStep({
      entity: "customer",
      fields: ["id"],
      filters: { email },
    }).config({ name: "get-google-customer" })

    const customer = validateGoogleCustomerExistsStep({ customers, email })
    const stepInput = transform(
      { input, customer },
      ({ input, customer }) => ({
        authIdentityId: input.auth_identity_id,
        actorType: "customer",
        value: customer.id,
      })
    )

    setAuthAppMetadataStep(stepInput)

    return new WorkflowResponse({ customer_id: customer.id })
  }
)
