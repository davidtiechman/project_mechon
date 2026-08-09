import { Text } from "@modules/common/components/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

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

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group block focus-visible:outline-none"
    >
      <div className="h-full" data-testid="product-wrapper">
        <div className="relative overflow-hidden rounded-[18px] bg-white">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            imageFit="cover"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 flex h-[76px] items-center justify-between gap-3 bg-[#2f211b]/90 px-4 text-right text-white backdrop-blur-sm">
          <Text
              className="min-w-0 flex-1 overflow-hidden text-ellipsis text-sm font-medium leading-5 text-white"
            data-testid="product-title"
          >
            {product.title}
          </Text>
            <div className="flex shrink-0 items-center gap-x-2 [&_[data-testid=original-price]]:!text-[#d8cfc7] [&_[data-testid=price]]:!text-white">
            {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
            </div>
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
