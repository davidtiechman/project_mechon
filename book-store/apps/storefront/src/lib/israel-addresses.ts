export type IsraeliCity = { code: number; name: string }
export type IsraeliStreet = { code: number; name: string }

export const ISRAEL_CITIES_RESOURCE = "f01dec33-b09b-482d-8413-e9b4fcbc4d7f"
export const ISRAEL_STREETS_RESOURCE = "9ad3862c-8391-4b2f-84a4-2d4c68625f4b"

const DATASTORE_URL = "https://data.gov.il/api/3/action/datastore_search"

type DatastoreResponse<T> = {
  success: boolean
  result: { records: T[]; total: number }
}

async function datastoreSearch<T>(
  resourceId: string,
  params: Record<string, string>,
) {
  const url = new URL(DATASTORE_URL)
  url.searchParams.set("resource_id", resourceId)
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  )

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok)
    throw new Error("Government address database is unavailable")
  const body = (await response.json()) as DatastoreResponse<T>
  if (!body.success)
    throw new Error("Government address database returned an error")
  return body.result
}

export async function searchIsraeliCities(query: string) {
  const result = await datastoreSearch<{ Code: number; Name_Hebrew: string }>(
    ISRAEL_CITIES_RESOURCE,
    { limit: "1500" },
  )
  const normalizedQuery = query.trim().toLocaleLowerCase("he")

  return result.records
    .map((record) => ({
      code: Number(record.Code),
      name: record.Name_Hebrew.trim(),
    }))
    .filter(
      (city) =>
        !normalizedQuery ||
        city.name.toLocaleLowerCase("he").includes(normalizedQuery),
    )
    .sort((a, b) => {
      const aName = a.name.toLocaleLowerCase("he")
      const bName = b.name.toLocaleLowerCase("he")
      const aRank =
        aName === normalizedQuery
          ? 0
          : aName.startsWith(normalizedQuery)
            ? 1
            : 2
      const bRank =
        bName === normalizedQuery
          ? 0
          : bName.startsWith(normalizedQuery)
            ? 1
            : 2
      return aRank - bRank || a.name.localeCompare(b.name, "he")
    })
    .slice(0, 30)
}

export async function getIsraeliStreets(cityCode: number) {
  const result = await datastoreSearch<{
    סמל_רחוב: number
    שם_רחוב: string
  }>(ISRAEL_STREETS_RESOURCE, {
    filters: JSON.stringify({ סמל_ישוב: cityCode }),
    limit: "5000",
  })

  return result.records
    .map((record) => ({
      code: Number(record.סמל_רחוב),
      name: record.שם_רחוב.trim(),
    }))
    .filter(
      (street, index, streets) =>
        street.name &&
        streets.findIndex((candidate) => candidate.name === street.name) ===
          index,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "he"))
}
