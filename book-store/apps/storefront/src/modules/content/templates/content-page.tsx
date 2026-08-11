import Image from "next/image"
import { ContentItem } from "@lib/data/site-content"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function ContentPageTemplate({ item }: { item: ContentItem }) {
  return <main dir="rtl" className="min-h-[60vh] bg-[#faf6f1]">
    <header className="border-b border-[#ddcec0] bg-[#f8f1ea]">
      <div className="content-container py-14 text-right small:py-20">
        <h1 className="text-4xl font-normal text-[#4a2d21] small:text-5xl">{item.title || item.name}</h1>
        {(item.excerpt || item.short_description) && <p className="mt-5 max-w-3xl text-lg leading-8 text-[#62594d]">{item.excerpt || item.short_description}</p>}
        {item.hero_image && <Image src={item.hero_image} alt={item.image_alt || ""} width={1200} height={600} className="mt-8 max-h-[500px] w-full rounded object-cover" />}
      </div>
    </header>
    {item.content && <article className="content-container prose prose-lg max-w-4xl py-14 text-right" dangerouslySetInnerHTML={{ __html: item.content }} />}
    {item.products && item.products.length > 0 && <section className="content-container pb-14"><h2 className="mb-6 text-3xl text-[#4a2d21]">ספרי המותג</h2><ul className="grid grid-cols-2 gap-5 small:grid-cols-3 medium:grid-cols-4">{item.products.map((product) => <li key={product.id}><LocalizedClientLink href={`/products/${product.handle}`} className="block rounded border border-[#ddcec0] bg-white p-4">{product.thumbnail && <Image src={product.thumbnail} alt="" width={400} height={500} className="mb-3 aspect-[4/5] w-full object-contain" />}<h3>{product.title}</h3></LocalizedClientLink></li>)}</ul></section>}
  </main>
}
