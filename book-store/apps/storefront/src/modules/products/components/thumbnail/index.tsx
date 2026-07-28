import { clx } from "@modules/common/components/ui"
import Image from "next/image"
import React from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"
import { resolveMediaUrl } from "@lib/util/resolve-media-url"

type ThumbnailProps = {
  thumbnail?: string | null
  images?: { url?: string }[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  imageFit?: "contain" | "cover"
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  className,
  imageFit = "contain",
  "data-testid": dataTestid,
}) => {
  const initialImage = resolveMediaUrl(thumbnail || images?.[0]?.url)

  return (
    <div
      className={clx(
        "relative w-full overflow-hidden bg-transparent",
        className,
        {
          "aspect-[11/14]": size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} imageFit={imageFit} />
    </div>
  )
}

const ImageOrPlaceholder = ({
  image,
  size,
  imageFit,
}: Pick<ThumbnailProps, "size" | "imageFit"> & { image?: string }) => {
  return image ? (
    <Image
      src={image}
      alt="תמונת הספר"
      className={clx(
        "absolute inset-0 object-center transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transform-none",
        imageFit === "cover" ? "object-cover" : "object-contain"
      )}
      draggable={false}
      quality={50}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
