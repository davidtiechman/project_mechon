import { listContent } from "@lib/data/site-content"
import { getBaseURL } from "@lib/util/env"
import { MetadataRoute } from "next"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, brands, articles] = await Promise.all([listContent("pages"), listContent("brands"), listContent("articles")])
  const base = getBaseURL().replace(/\/$/, "")
  return [
    { url: base, lastModified: new Date() },
    ...pages.map((item) => ({ url: `${base}/il/pages/${item.slug}`, lastModified: new Date() })),
    ...brands.map((item) => ({ url: `${base}/il/brands/${item.slug}`, lastModified: new Date() })),
    ...articles.map((item) => ({ url: `${base}/il/articles/${item.slug}`, lastModified: item.published_at ? new Date(item.published_at) : new Date() })),
  ]
}
