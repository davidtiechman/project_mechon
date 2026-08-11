import "server-only"

const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

async function getContent<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${backendUrl}/store/site-content${path}`, {
      headers: publishableKey ? { "x-publishable-api-key": publishableKey } : undefined,
      next: { revalidate: 60, tags: ["site-content"] },
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

export type SeoFields = { seo_title?: string; seo_description?: string; canonical_url?: string; og_title?: string; og_description?: string; og_image?: string }
export type ContentItem = { id: string; title?: string; name?: string; slug?: string; excerpt?: string; short_description?: string; content?: string; status?: string; featured_image?: string; hero_image?: string; image_alt?: string; author?: string; published_at?: string; seo?: SeoFields; products?: Array<{ id: string; handle: string; title: string; thumbnail?: string }> }
export type HomeContent = { sections: Array<Record<string, any>>; articles: ContentItem[]; brands: ContentItem[]; banners: Array<Record<string, any>> }

export const getHomeContent = () => getContent<HomeContent>("/home")
export const listContent = async (entity: "pages" | "brands" | "articles") => (await getContent<{ items: ContentItem[] }>(`/${entity}?limit=100`))?.items || []
export const getContentItem = async (entity: "pages" | "brands" | "articles", slug: string) => (await getContent<{ item: ContentItem }>(`/${entity}/${encodeURIComponent(slug)}`))?.item || null
