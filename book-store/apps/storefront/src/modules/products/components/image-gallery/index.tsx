"use client"

import { HttpTypes } from "@medusajs/types"
import { PointerEvent } from "react"
import { Container } from "@modules/common/components/ui"
import Image from "next/image"
import { resolveMediaUrl } from "@lib/util/resolve-media-url"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle: string
}

const updateZoom = (event: PointerEvent<HTMLDivElement>) => {
  // Keep touch scrolling and pen interactions unchanged.
  if (event.pointerType !== "mouse") return

  const frame = event.currentTarget
  const bounds = frame.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return

  const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
  const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))

  frame.style.setProperty("--product-image-origin", `${x * 100}% ${y * 100}%`)
  frame.style.setProperty("--product-image-zoom", "2")
}

const resetZoom = (event: PointerEvent<HTMLDivElement>) => {
  event.currentTarget.style.removeProperty("--product-image-zoom")
  event.currentTarget.style.removeProperty("--product-image-origin")
}

const ImageGallery = ({ images, productTitle }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 small:mx-16 gap-y-4">
        {images.map((image, index) => {
          const imageUrl = resolveMediaUrl(image.url)

          return (
            <Container
              key={`${image.id}:${imageUrl}`}
              className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
              id={image.id}
              onPointerEnter={imageUrl ? updateZoom : undefined}
              onPointerMove={imageUrl ? updateZoom : undefined}
              onPointerLeave={resetZoom}
              onPointerCancel={resetZoom}
            >
              {!!imageUrl && (
                <Image
                  src={imageUrl}
                  priority={index <= 2 ? true : false}
                  className="absolute inset-0 rounded-rounded"
                  alt={`${productTitle}, תמונה ${index + 1}`}
                  fill
                  unoptimized
                  draggable={false}
                  sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                  style={{
                    objectFit: "cover",
                    transform: "scale(var(--product-image-zoom, 1))",
                    transformOrigin: "var(--product-image-origin, 50% 50%)",
                  }}
                />
              )}
            </Container>
          )
        })}
      </div>
    </div>
  )
}

export default ImageGallery
