import type { Metadata } from "next"
import { Frank_Ruhl_Libre, Heebo } from "next/font/google"
import { getBaseURL } from "@lib/util/env"
import "../styles/globals.css"

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
})

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  variable: "--font-frank-ruhl",
  display: "swap",
})

export const metadata: Metadata = {
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
      <body className={`${heebo.variable} ${frankRuhlLibre.variable}`}>
        {children}
      </body>
    </html>
  )
}
