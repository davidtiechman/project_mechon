import { Module } from "@medusajs/framework/utils"
import NedarimPaymentsService from "./service"

export const NEDARIM_PAYMENTS_MODULE = "nedarimPayments"
export default Module(NEDARIM_PAYMENTS_MODULE, { service: NedarimPaymentsService })
