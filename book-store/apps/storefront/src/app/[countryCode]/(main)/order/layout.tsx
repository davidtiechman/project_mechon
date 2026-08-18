import { privatePageRobots } from "@lib/util/seo"
import type { Metadata } from "next"

export const metadata: Metadata = { robots: privatePageRobots }

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children
}
