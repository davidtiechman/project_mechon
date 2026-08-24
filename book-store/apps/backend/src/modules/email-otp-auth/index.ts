import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import EmailOtpAuthService from "./service"

export default ModuleProvider(Modules.AUTH, { services: [EmailOtpAuthService] })
