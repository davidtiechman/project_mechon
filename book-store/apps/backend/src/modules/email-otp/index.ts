import { Module } from "@medusajs/framework/utils"
import EmailOtpModuleService from "./service"

export const EMAIL_OTP_MODULE = "emailOtp"
export default Module(EMAIL_OTP_MODULE, { service: EmailOtpModuleService })
