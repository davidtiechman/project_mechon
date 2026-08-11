import { ContentBanner as ContentBannerType } from "@lib/data/site-content"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function ContentBanner({ banner }: { banner: ContentBannerType }) {
  const body = <div className="content-container flex min-h-12 flex-col items-center justify-center gap-2 py-3 text-center small:flex-row small:gap-5">
    <div>
      {banner.title && <strong className="block text-base">{banner.title}</strong>}
      {banner.subtitle && <span className="text-sm opacity-90">{banner.subtitle}</span>}
    </div>
    {banner.button_text && banner.button_url && <span className="rounded border border-current px-3 py-1 text-sm font-medium">{banner.button_text}</span>}
  </div>

  const className = `block overflow-hidden bg-[#4a2d21] text-[#fff8ed] ${banner.desktop_image ? "bg-cover bg-center" : ""}`
  const style = banner.desktop_image ? { backgroundImage: `linear-gradient(#2d1c16aa, #2d1c16aa), url(${banner.desktop_image})` } : undefined
  if (!banner.button_url) return <section className={className} style={style} dir="rtl">{body}</section>
  if (/^https?:\/\//.test(banner.button_url)) return <a className={className} style={style} href={banner.button_url} target={banner.open_new_tab ? "_blank" : undefined} rel={banner.open_new_tab ? "noopener noreferrer" : undefined} dir="rtl">{body}</a>
  return <LocalizedClientLink className={className} style={style} href={banner.button_url}>{body}</LocalizedClientLink>
}
