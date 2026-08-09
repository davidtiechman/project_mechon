import { Text } from "@modules/common/components/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"
import CardAddToCart from "./card-add-to-cart"

export default async function ProductPreview({
  product,
  isFeatured,
  region: _region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })

  const singleVariant =
    product.variants?.length === 1 ? product.variants[0] : undefined
  const singleVariantInStock = singleVariant
    ? !singleVariant.manage_inventory ||
      singleVariant.allow_backorder ||
      (singleVariant.inventory_quantity ?? 0) > 0
    : true

  return (
    <article
      className="group/card relative h-full overflow-hidden rounded-[18px] bg-white shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-[#9a7130]"
      data-testid="product-wrapper"
    >
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className="group block h-full focus-visible:outline-none"
      >
        <div className="overflow-hidden bg-white">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            imageFit="cover"
          />
        </div>

        <div className="flex min-h-[132px] flex-col bg-white px-4 py-3 text-right" dir="rtl">
          <Text
            className="overflow-hidden text-base font-semibold leading-6 text-[#352820]"
            data-testid="product-title"
          >
            {product.title}
          </Text>

          {(product.subtitle || product.description) && (
            <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[#756d5e]">
              {product.subtitle || product.description}
            </p>
          )}

          <div className="mt-auto flex items-center gap-x-2 pt-2 [&_[data-testid=original-price]]:!text-base [&_[data-testid=price]]:!text-lg [&_[data-testid=price]]:!font-bold [&_[data-testid=price]]:!text-[#4a2d21]">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
          </div>
        </div>
      </LocalizedClientLink>
      <CardAddToCart
        variantId={singleVariant?.id}
        productHandle={product.handle}
        disabled={!!singleVariant && !singleVariantInStock}
      />
    </article>
  )
}
