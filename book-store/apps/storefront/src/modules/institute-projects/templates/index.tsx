import { getCategoryByHandle } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { InstituteProject } from "@lib/data/institute-projects"
import ProductPreview from "@modules/products/components/product-preview"

export default async function InstituteProjectTemplate({
  project,
  countryCode,
}: {
  project: InstituteProject
  countryCode: string
}) {
  const [region, category] = await Promise.all([
    getRegion(countryCode),
    getCategoryByHandle([project.categoryHandle]),
  ])

  const products = category
    ? await listProducts({
        countryCode,
        queryParams: {
          category_id: [category.id],
          limit: 100,
          order: "-created_at",
        },
      }).then(({ response }) => response.products)
    : []

  return (
    <main dir="rtl">
      <section className="border-b border-[#ddcec0] bg-[#f8f1ea]">
        <div className="content-container py-14 text-right small:py-20">
          <span className="eyebrow"></span>
          <h1 className="mt-3 text-4xl font-normal text-[#4a2d21] small:text-5xl">
            {project.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#62594d] small:text-lg">
            {project.description}
          </p>
        </div>
      </section>

      <section className="content-container py-14 small:py-20" aria-labelledby="project-books-heading">
        <h2 id="project-books-heading" className="mb-10 text-2xl text-[#3b352a] small:text-3xl">
          ספרי המפעל
        </h2>
        {region && products.length > 0 ? (
          <ul className="grid w-full grid-cols-2 gap-x-5 gap-y-12 small:grid-cols-3 small:gap-x-8 small:gap-y-16 medium:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <ProductPreview product={product} region={region} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-home-state" role="status">
            ספרים המשויכים למפעל זה יוצגו כאן בקרוב.
          </div>
        )}
      </section>
    </main>
  )
}
