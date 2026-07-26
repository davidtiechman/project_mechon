import { readFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const dashboardTranslations = resolve(
  here,
  "../../../node_modules/@medusajs/dashboard/src/i18n/translations"
)
const output = resolve(here, "../src/admin/i18n/json/he.json")

const english = JSON.parse(
  await readFile(resolve(dashboardTranslations, "en.json"), "utf8")
)
const bundledHebrew = JSON.parse(
  await readFile(resolve(dashboardTranslations, "he.json"), "utf8")
)

const flatten = (value, prefix = "", result = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, path, result)
    } else {
      result[path] = child
    }
  }
  return result
}

const setPath = (target, path, value) => {
  const parts = path.split(".")
  const leaf = parts.pop()
  let cursor = target
  for (const part of parts) {
    cursor[part] ??= {}
    cursor = cursor[part]
  }
  cursor[leaf] = value
}

const protectTokens = (text) => {
  const tokens = []
  const protectedText = text.replace(
    /(\{\{[^}]+\}\}|<\/?\d+>|https?:\/\/\S+)/g,
    (token) => {
      const marker = ` __MEDUSA_TOKEN_${tokens.length}__ `
      tokens.push(token)
      return marker
    }
  )
  return { protectedText, tokens }
}

const restoreTokens = (text, tokens) =>
  tokens.reduce(
    (result, token, index) =>
      result.replace(
        new RegExp(`\\s*__MEDUSA_TOKEN_${index}__\\s*`, "g"),
        token
      ),
    text
  )

const translate = async (text) => {
  const { protectedText, tokens } = protectTokens(text)
  const url = new URL("https://translate.googleapis.com/translate_a/single")
  url.searchParams.set("client", "gtx")
  url.searchParams.set("sl", "en")
  url.searchParams.set("tl", "he")
  url.searchParams.set("dt", "t")
  url.searchParams.set("q", protectedText)

  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url)
    if (response.ok) {
      const payload = await response.json()
      return restoreTokens(
        payload[0].map((segment) => segment[0]).join(""),
        tokens
      ).trim()
    }
    if (attempt === 4) {
      throw new Error(`Translation failed (${response.status}): ${text}`)
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, attempt * 500)
    )
  }
}

const englishFlat = flatten(english)
const hebrewFlat = flatten(bundledHebrew)
const missing = Object.keys(englishFlat).filter((key) => !(key in hebrewFlat))
const completed = structuredClone(bundledHebrew)

let cursor = 0
const workers = Array.from({ length: 4 }, async () => {
  while (cursor < missing.length) {
    const index = cursor++
    const key = missing[index]
    const source = englishFlat[key]
    const translated =
      typeof source === "string" ? await translate(source) : source
    setPath(completed, key, translated)
    process.stdout.write(`\rTranslated ${index + 1}/${missing.length}`)
  }
})

await Promise.all(workers)

// Google can reorder XML-like interpolation tags in this sentence. Keep the
// reviewed version explicit so regenerating the dictionary is deterministic.
setPath(
  completed,
  "priceLists.quantityPricing.summaries.range",
  "אם <0>{{attribute}}</0> הוא בין <1>{{min}}</1> לבין <2>{{max}}</2>"
)

const reviewedTranslations = {
  "profile.mfa.title": "אימות דו-שלבי",
  "profile.mfa.status": "מצב",
  "profile.mfa.description": "דרוש שימוש באפליקציית אימות בעת הכניסה.",
  "profile.mfa.method": "שיטת אימות",
  "profile.mfa.disabled": "מושבת",
  "profile.mfa.authenticatorApp": "אפליקציית אימות",
  "profile.mfa.noMethod": "לא הוגדרה שיטת אימות",
  "profile.mfa.disableTitle": "השבתת אימות דו-שלבי",
  "profile.mfa.disableSuccess": "האימות הדו-שלבי הושבת",
  "profile.mfa.disableChallengeDescription":
    "הזן את הקוד בן 6 הספרות מאפליקציית האימות כדי להשבית את האימות הדו-שלבי.",
}

for (const [path, translation] of Object.entries(reviewedTranslations)) {
  setPath(completed, path, translation)
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(completed, null, 2)}\n`, "utf8")
process.stdout.write(`\nWrote ${output}\n`)
