import { MedusaError } from "@medusajs/framework/utils"
import sanitizeHtml from "sanitize-html"
import { z } from "zod"

export const contentEntities = {
  pages: { list: "listAndCountContentPages", retrieve: "retrieveContentPage", create: "createContentPages", update: "updateContentPages", remove: "deleteContentPages" },
  sections: { list: "listAndCountContentSections", retrieve: "retrieveContentSection", create: "createContentSections", update: "updateContentSections", remove: "deleteContentSections" },
  brands: { list: "listAndCountBrands", retrieve: "retrieveBrand", create: "createBrands", update: "updateBrands", remove: "deleteBrands" },
  articles: { list: "listAndCountArticles", retrieve: "retrieveArticle", create: "createArticles", update: "updateArticles", remove: "deleteArticles" },
  banners: { list: "listAndCountBanners", retrieve: "retrieveBanner", create: "createBanners", update: "updateBanners", remove: "deleteBanners" },
  "navigation-menus": { list: "listAndCountNavigationMenus", retrieve: "retrieveNavigationMenu", create: "createNavigationMenus", update: "updateNavigationMenus", remove: "deleteNavigationMenus" },
  "navigation-items": { list: "listAndCountNavigationItems", retrieve: "retrieveNavigationItem", create: "createNavigationItems", update: "updateNavigationItems", remove: "deleteNavigationItems" },
  faq: { list: "listAndCountFaqItems", retrieve: "retrieveFaqItem", create: "createFaqItems", update: "updateFaqItems", remove: "deleteFaqItems" },
  "footer-sections": { list: "listAndCountFooterSections", retrieve: "retrieveFooterSection", create: "createFooterSections", update: "updateFooterSections", remove: "deleteFooterSections" },
  "footer-links": { list: "listAndCountFooterLinks", retrieve: "retrieveFooterLink", create: "createFooterLinks", update: "updateFooterLinks", remove: "deleteFooterLinks" },
  settings: { list: "listAndCountSiteSettings", retrieve: "retrieveSiteSetting", create: "createSiteSettings", update: "updateSiteSettings", remove: "deleteSiteSettings" },
} as const

export type ContentEntity = keyof typeof contentEntities

const status = z.enum(["draft", "published", "archived"])
const commonSchema = z.object({
  id: z.string().optional(),
  status: status.optional(),
  sort_order: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
  published_at: z.coerce.date().nullable().optional(),
}).passthrough()

const schemas: Partial<Record<ContentEntity, z.ZodType>> = {
  pages: commonSchema.extend({ title: z.string().trim().min(1), slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  brands: commonSchema.extend({ name: z.string().trim().min(1), slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  articles: commonSchema.extend({ title: z.string().trim().min(1), slug: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  banners: commonSchema.extend({ internal_name: z.string().trim().min(1), placement: z.enum(["homepage_top", "homepage_middle", "products", "articles", "global"]) }),
  sections: commonSchema.extend({ owner_type: z.enum(["home", "page", "brand"]), owner_id: z.string().min(1), internal_name: z.string().min(1), type: z.enum(["hero", "text", "image_text", "banner", "cta", "products", "brands", "articles", "gallery", "faq"]) }),
  faq: commonSchema.extend({ question: z.string().trim().min(1), answer: z.string().trim().min(1) }),
}

const richTextFields = new Set(["content", "answer"])

export function sanitizeContentPayload(entity: ContentEntity, value: unknown, partial = false): Record<string, any> {
  const raw = z.record(z.string(), z.unknown()).parse(value)
  const cleaned = Object.fromEntries(Object.entries(raw).map(([key, field]) => [
    key,
    richTextFields.has(key) && typeof field === "string"
      ? sanitizeHtml(field, {
          allowedTags: ["p", "h2", "h3", "h4", "strong", "em", "ul", "ol", "li", "a", "blockquote", "img", "br"],
          allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"] },
          allowedSchemes: ["http", "https", "mailto"],
          transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true) },
        })
      : field,
  ]))

  const schema = schemas[entity] ?? commonSchema
  const result = partial ? (schema as z.ZodObject<any>).partial().safeParse(cleaned) : schema.safeParse(cleaned)
  if (!result.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, result.error.issues.map((issue) => issue.message).join(", "))
  }
  return result.data as Record<string, any>
}

export function resolveContentEntity(entity: string) {
  if (!(entity in contentEntities)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Unknown content entity")
  }
  return entity as ContentEntity
}

export function listConfig(entity: ContentEntity, query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)
  const filters: Record<string, unknown> = {}
  for (const key of ["status", "active", "placement", "owner_type", "owner_id", "menu_id", "section_id", "handle", "slug"]) {
    if (query[key] !== undefined) filters[key] = query[key]
  }
  const order = entity === "articles"
    ? { published_at: "DESC", updated_at: "DESC" }
    : ["settings", "navigation-menus"].includes(entity)
      ? { updated_at: "DESC" }
      : { sort_order: "ASC", updated_at: "DESC" }
  return { filters, config: { take: limit, skip: offset, order } }
}
