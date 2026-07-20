import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="hero-ornament" aria-hidden="true" />
      <div className="content-container relative z-10 grid items-center gap-12 py-20 small:grid-cols-[1.2fr_0.8fr] small:py-28">
        <div className="max-w-3xl">
          <span className="eyebrow text-[#d8bf86]">מכון להוצאת והאדרת תורת רבותינו זיע״א</span>
          <h1>מכון<br /><em>מעשה רוקח</em></h1>
          <p>
           מהדירים את תורות רבותינו מבעלזא, יצירת פאר של סידור עבודת השם
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <LocalizedClientLink href="/store" className="brand-button brand-button-light">
              לחנות הספרים
            </LocalizedClientLink>
            <a href="#about" className="hero-secondary-link">על המכון <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="hero-mark" aria-hidden="true">
          <span className="hero-mark-ring" />
          <Image
            src="/images/institute-emblem.png"
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
