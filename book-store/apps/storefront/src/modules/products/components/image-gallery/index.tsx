"use client"

import { HttpTypes } from "@medusajs/types"
import { PointerEvent, useState } from "react"
import { Container } from "@modules/common/components/ui"
import Image from "next/image"
import { resolveMediaUrl } from "@lib/util/resolve-media-url"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle: string
  thumbnail?: string | null
}

const updateZoom = (event: PointerEvent<HTMLDivElement>) => {
  // Keep touch scrolling and pen interactions unchanged.
  if (event.pointerType !== "mouse") return

  const frame = event.currentTarget
  const bounds = frame.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return

  const x = Math.max(
    0,
    Math.min(1, (event.clientX - bounds.left) / bounds.width)
  )
  const y = Math.max(
    0,
    Math.min(1, (event.clientY - bounds.top) / bounds.height)
  )

  frame.style.setProperty("--product-image-origin", `${x * 100}% ${y * 100}%`)
  frame.style.setProperty("--product-image-zoom", "2")
}

const resetZoom = (event: PointerEvent<HTMLDivElement>) => {
  event.currentTarget.style.removeProperty("--product-image-zoom")
  event.currentTarget.style.removeProperty("--product-image-origin")
}

const ImageGallery = ({
  images,
  productTitle,
  thumbnail,
}: ImageGalleryProps) => {
  const primaryUrl = resolveMediaUrl(thumbnail)
  const imageUrls = Array.from(
    new Set([
      ...(primaryUrl ? [primaryUrl] : []),
      ...images
        .map((image) => resolveMediaUrl(image.url))
        .filter((url): url is string => !!url),
    ])
  )
  const [selectedUrl, setSelectedUrl] = useState(imageUrls[0])
  const activeUrl = imageUrls.includes(selectedUrl) ? selectedUrl : imageUrls[0]

  if (!activeUrl) return null

  return (
    <div className="flex items-start relative">
      <div className="flex min-w-0 flex-col flex-1 small:mx-16 gap-y-4">
        <Container
          key={activeUrl}
          className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
          onPointerEnter={updateZoom}
          onPointerMove={updateZoom}
          onPointerLeave={resetZoom}
          onPointerCancel={resetZoom}
        >
          <Image
            src={activeUrl}
            priority
            className="absolute inset-0 rounded-rounded"
            alt={`${productTitle}, תמונה ${imageUrls.indexOf(activeUrl) + 1}`}
            fill
            unoptimized
            draggable={false}
            sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
            style={{
              objectFit: "contain",
              transform: "scale(var(--product-image-zoom, 1))",
              transformOrigin: "var(--product-image-origin, 50% 50%)",
            }}
          />
        </Container>
        {imageUrls.length > 1 && (
          <div
            className="flex flex-wrap justify-center gap-3"
            role="group"
            aria-label={`תמונות של ${productTitle}`}
          >
            {imageUrls.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={`הצגת תמונה ${index + 1} של ${productTitle}`}
                aria-pressed={url === activeUrl}
                onClick={() => setSelectedUrl(url)}
                className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a682d] focus-visible:ring-offset-2 ${
                  url === activeUrl
                    ? "border-[#8a682d]"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageGallery
