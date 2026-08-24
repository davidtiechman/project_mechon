import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { Resend } from "resend"
import { renderToStaticMarkup } from "react-dom/server"
import {
  AdminInviteEmail,
  AdminPasswordResetEmail,
  CustomerLoginCodeEmail,
  OrderCustomerEmail,
  OrderOwnerEmail,
} from "./emails"

type ResendOptions = {
  api_key: string
  from_email: string
  from_name: string
}

type InjectedDependencies = { logger: Logger }

const templates = {
  "order-customer": OrderCustomerEmail,
  "order-owner": OrderOwnerEmail,
  "admin-password-reset": AdminPasswordResetEmail,
  "customer-login-code": CustomerLoginCodeEmail,
  "admin-invite": AdminInviteEmail,
} as const

type TemplateName = keyof typeof templates

export default class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  private readonly client: Resend
  private readonly logger: Logger
  private readonly options: ResendOptions

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super()
    this.client = new Resend(options.api_key)
    this.logger = logger
    this.options = options
  }

  static validateOptions(options: Record<string, unknown>) {
    for (const key of ["api_key", "from_email", "from_name"]) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Resend notification provider requires the ${key} option.`
        )
      }
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const templateName = notification.template as TemplateName
    const Template = templates[templateName]

    if (!Template) {
      this.logger.error(
        `[resend] Unknown email template: ${notification.template}`
      )
      return {}
    }

    const displayId = String(notification.data?.display_id ?? "")
    const subjects: Record<TemplateName, string> = {
      "customer-login-code": "קוד הכניסה שלך למכון מעשה רוקח",
      "order-customer": `הזמנה מספר #${displayId} התקבלה בהצלחה`,
      "order-owner": `התקבלה הזמנה חדשה #${displayId}`,
      "admin-password-reset": "איפוס סיסמה למערכת הניהול",
      "admin-invite": "הזמנה למערכת הניהול של מכון מעשה רוקח",
    }

    try {
      const html = `<!doctype html>${renderToStaticMarkup(
        Template((notification.data ?? {}) as never)
      )}`

      const { data, error } = await this.client.emails.send({
        from: `${this.options.from_name} <${this.options.from_email}>`,
        to: [notification.to],
        subject: subjects[templateName],
        html,
      })

      if (error || !data) {
        this.logger.error(
          `[resend] Failed to send ${templateName} email to ${notification.to}: ${error?.message ?? "unknown error"}`
        )
        return {}
      }

      return { id: data.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error"
      this.logger.error(
        `[resend] Failed to send ${templateName} email to ${notification.to}: ${message}`
      )
      return {}
    }
  }
}
