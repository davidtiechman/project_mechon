import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { HeroProductSearch } from "@modules/search/components/global-product-search"

type HeroProps = {
  eyebrow?: string
  title?: string
  description?: string
  buttonText?: string
  buttonUrl?: string
  image?: string
  countryCode: string
}

const Hero = ({ eyebrow, title, description, buttonText, buttonUrl, image, countryCode }: HeroProps) => {
  const hasRichDescription = Boolean(description?.match(/<[^>]+>/))

  return (
    <section className="hero-section">
      <div className="content-container relative z-10 grid min-w-0 grid-cols-1 items-center gap-8 py-6 small:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] small:gap-12 small:py-[36px]">
        <div className="min-w-0 max-w-3xl [overflow-wrap:anywhere]">
          <span className="eyebrow text-[#d8bf86]">{eyebrow || "מכון להוצאת והאדרת תורת רבותינו זיע״א"}</span>
          <h1>{title || "מכון מעשה רוקח"}</h1>
          {hasRichDescription ? (
            <div dangerouslySetInnerHTML={{ __html: description! }} />
          ) : (
            <p>
              {description ||
                "מהדירים את תורות רבותינו מבעלזא, יצירת פאר של סידור עבודת השם"}
            </p>
          )}
          <HeroProductSearch countryCode={countryCode} />
          <div className="mt-9 flex flex-wrap gap-4">
            <LocalizedClientLink href={buttonUrl || "/store"} className="brand-button brand-button-light">
              {buttonText || "לחנות הספרים"}
            </LocalizedClientLink>
            <a href="#about" className="hero-secondary-link">על המכון <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="hero-mark" aria-hidden="true">
          <Image
            src={image || "/images/institute-emblem-open-left.png"}
            alt=""
            width={270}
            height={270}
            className="hero-emblem"
            priority
          />
        </div>
      </div>
    </section>
  )
}

export default Hero
