import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

type HeroProps = {
  eyebrow?: string
  title?: string
  description?: string
  buttonText?: string
  buttonUrl?: string
  image?: string
}

const Hero = ({ eyebrow, title, description, buttonText, buttonUrl, image }: HeroProps) => {
  return (
    <section className="hero-section">
      <div className="content-container relative z-10 grid items-center gap-12 py-20 small:grid-cols-[1.2fr_0.8fr] small:py-28">
        <div className="max-w-3xl">
          <span className="eyebrow text-[#d8bf86]">{eyebrow || "מכון להוצאת והאדרת תורת רבותינו זיע״א"}</span>
          <h1>{title || "מכון מעשה רוקח"}</h1>
          <p>
           {description || "מהדירים את תורות רבותינו מבעלזא, יצירת פאר של סידור עבודת השם"}
          </p>
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
