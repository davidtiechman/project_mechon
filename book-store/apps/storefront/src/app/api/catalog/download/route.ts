import { getActiveCatalog } from "@lib/data/site-content"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function encodeFilename(filename: string) {
  return encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export async function GET() {
  const catalog = await getActiveCatalog()

  if (!catalog) {
    return NextResponse.json({ message: "לא נמצא קטלוג פעיל" }, { status: 404 })
  }

  let fileUrl: URL
  try {
    fileUrl = new URL(catalog.file_url)
  } catch {
    return NextResponse.json({ message: "כתובת הקטלוג אינה תקינה" }, { status: 502 })
  }

  if (!["http:", "https:"].includes(fileUrl.protocol)) {
    return NextResponse.json({ message: "כתובת הקטלוג אינה נתמכת" }, { status: 502 })
  }

  let upstream: Response
  try {
    upstream = await fetch(fileUrl, { cache: "no-store" })
  } catch {
    return NextResponse.json({ message: "לא ניתן להוריד את הקטלוג" }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ message: "לא ניתן להוריד את הקטלוג" }, { status: 502 })
  }

  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-disposition": `attachment; filename="catalog.pdf"; filename*=UTF-8''${encodeFilename(catalog.file_name)}`,
    "content-type": upstream.headers.get("content-type") || "application/pdf",
  })
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("content-length", contentLength)

  return new Response(upstream.body, { status: 200, headers })
}
