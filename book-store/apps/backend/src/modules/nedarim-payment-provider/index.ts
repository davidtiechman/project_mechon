import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import NedarimPaymentProvider from "./service"

export default ModuleProvider(Modules.PAYMENT, { services: [NedarimPaymentProvider] })
