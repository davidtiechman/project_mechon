import type { Metadata } from "next"
import { getBaseURL } from "@lib/util/env"
import "../styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "מכון מעשה רוקח",
    template: "%s | מכון מעשה רוקח",
  },
  description: "ספרי קודש, סידורים תהילים והוצאה לאור מבית מכון מעשה רוקח",
  icons: {
    icon: "/images/institute-emblem-refined.png",
  },
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
