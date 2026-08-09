import type { Metadata } from "next"
import { Heebo } from "next/font/google"
import { getBaseURL } from "@lib/util/env"
import "../styles/globals.css"

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
})

export const metadata: Metadata = {
  verification: {
    google: "QfXV3TadhjRB12PIlCZMmvjLxh9OAkqxK6xzGDc4TPY",
  },
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "מכון מעשה רוקח",
    template: "%s | מכון מעשה רוקח",
  },
  description: "ספרי קודש, סידורים תהילים והוצאה לאור מבית מכון מעשה רוקח",
  icons: {
    icon: "/images/institute-emblem-open-left.png",
  },
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={heebo.variable}>{children}</body>
    </html>
  )
}
