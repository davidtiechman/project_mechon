import { getIsraeliStreets } from "@lib/israel-addresses"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const cityCode = Number(request.nextUrl.searchParams.get("cityCode"))
  if (!Number.isInteger(cityCode) || cityCode <= 0) {
    return NextResponse.json(
      { streets: [], error: "יש לבחור עיר" },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json({ streets: await getIsraeliStreets(cityCode) })
  } catch {
    return NextResponse.json(
      { streets: [], error: "מאגר הרחובות אינו זמין כרגע" },
      { status: 503 },
    )
  }
}
