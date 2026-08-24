import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from "@medusajs/framework/types"
import { AbstractAuthModuleProvider, isString } from "@medusajs/framework/utils"
import type EmailOtpModuleService from "../email-otp/service"

type Dependencies = { emailOtp: EmailOtpModuleService }

export default class EmailOtpAuthService extends AbstractAuthModuleProvider {
  static identifier = "emailotp"
  static DISPLAY_NAME = "Email one-time code"
  protected emailOtp_: EmailOtpModuleService

  constructor({ emailOtp }: Dependencies) {
    super()
    this.emailOtp_ = emailOtp
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const { email, code } = data.body ?? {}
    if (!isString(email) || !isString(code) || !/^\d{6}$/.test(code)) {
      return { success: false, error: "Invalid email or code" }
    }
    try {
      await this.emailOtp_.consume(email, code)
      const authIdentity = await authIdentityService.retrieve({
        entity_id: await this.emailOtp_.normalizeEmail(email),
      })
      return { success: true, authIdentity }
    } catch {
      return { success: false, error: "Invalid email or code" }
    }
  }

  async register(): Promise<AuthenticationResponse> {
    return { success: false, error: "Registration with email code is not supported" }
  }

  async update(): Promise<AuthenticationResponse> {
    return { success: false, error: "Email code identities cannot be updated" }
  }
}
