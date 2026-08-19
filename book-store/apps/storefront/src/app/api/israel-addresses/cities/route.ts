import { searchIsraeliCities } from "@lib/israel-addresses"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.slice(0, 80) || ""
    return NextResponse.json({ cities: await searchIsraeliCities(query) })
  } catch {
    return NextResponse.json(
      { cities: [], error: "מאגר היישובים אינו זמין כרגע" },
      { status: 503 },
    )
  }
}
