"use client"

import type { ContentAdvertisement } from "@lib/data/site-content"
import { resolveMediaUrl } from "@lib/util/resolve-media-url"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useRef, useState } from "react"

const storageKey = (advertisement: ContentAdvertisement) =>
  `site-advertisement:${advertisement.id}:seen`

function wasAlreadyShown(advertisement: ContentAdvertisement) {
  try {
    if (advertisement.display_frequency === "once_session") {
      return sessionStorage.getItem(storageKey(advertisement)) === "1"
    }
    if (advertisement.display_frequency === "once_ever") {
      return localStorage.getItem(storageKey(advertisement)) === "1"
    }
  } catch {
    return false
  }
  return false
}

function rememberAsShown(advertisement: ContentAdvertisement) {
  try {
    if (advertisement.display_frequency === "once_session") {
      sessionStorage.setItem(storageKey(advertisement), "1")
    } else if (advertisement.display_frequency === "once_ever") {
      localStorage.setItem(storageKey(advertisement), "1")
    }
  } catch {
    // Storage can be unavailable in private browsing; the advertisement still works.
  }
}

export default function AdvertisementPopup({
  advertisements,
}: {
  advertisements: ContentAdvertisement[]
}) {
  const [advertisement, setAdvertisement] = useState<ContentAdvertisement | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const nextAdvertisement = advertisements.find((item) => !wasAlreadyShown(item))
    if (!nextAdvertisement) return

    const delay = Math.max(0, nextAdvertisement.show_delay_seconds || 0) * 1000
    const timeout = window.setTimeout(() => {
      rememberAsShown(nextAdvertisement)
      setAdvertisement(nextAdvertisement)
      setRemainingSeconds(Math.max(0, nextAdvertisement.auto_close_seconds || 0))
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [advertisements])

  useEffect(() => {
    if (!advertisement) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus({ preventScroll: true })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAdvertisement(null)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [advertisement])

  useEffect(() => {
    if (!advertisement || remainingSeconds <= 0) return
    const timeout = window.setTimeout(() => {
      if (remainingSeconds === 1) setAdvertisement(null)
      else setRemainingSeconds((current) => current - 1)
    }, 1000)
    return () => window.clearTimeout(timeout)
  }, [advertisement, remainingSeconds])

  if (!advertisement) return null

  const desktopImage = resolveMediaUrl(advertisement.desktop_image)
  const mobileImage = resolveMediaUrl(advertisement.mobile_image) || desktopImage
  const action = advertisement.button_text && advertisement.button_url ? (
    /^https?:\/\//.test(advertisement.button_url) ? (
      <a
        href={advertisement.button_url}
        target={advertisement.open_new_tab ? "_blank" : undefined}
        rel={advertisement.open_new_tab ? "noopener noreferrer" : undefined}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#6b5339] px-6 py-3 font-semibold text-white transition hover:bg-[#513d2a]"
      >
        {advertisement.button_text}
      </a>
    ) : (
      <LocalizedClientLink
        href={advertisement.button_url}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#6b5339] px-6 py-3 font-semibold text-white transition hover:bg-[#513d2a]"
      >
        {advertisement.button_text}
      </LocalizedClientLink>
    )
  ) : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAdvertisement(null)
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={advertisement.title ? "advertisement-title" : undefined}
        aria-label={advertisement.title ? undefined : "מודעה"}
        className="relative max-h-[92dvh] w-full max-w-3xl overflow-auto rounded-2xl bg-[#fffaf5] shadow-2xl"
        dir="rtl"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setAdvertisement(null)}
          aria-label="סגירת המודעה"
          className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-3xl leading-none text-[#51463a] shadow-md transition hover:bg-[#f3ebe3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b5339]"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="grid md:grid-cols-2">
          {desktopImage && (
            <picture className="block min-h-52 bg-[#eee4da] md:min-h-[430px]">
              {mobileImage && <source media="(max-width: 767px)" srcSet={mobileImage} />}
              <img
                src={desktopImage}
                alt={advertisement.image_alt || ""}
                className="h-full max-h-[45dvh] w-full object-cover md:max-h-none"
              />
            </picture>
          )}
          <div className={`flex flex-col justify-center p-6 text-center small:p-9 ${desktopImage ? "" : "md:col-span-2"}`}>
            {advertisement.title && (
              <h2 id="advertisement-title" className="text-2xl font-bold text-[#3f3025] small:text-3xl">
                {advertisement.title}
              </h2>
            )}
            {advertisement.body && (
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-[#66584c]">
                {advertisement.body}
              </p>
            )}
            {action && <div className="mt-6">{action}</div>}
            {advertisement.show_timer && advertisement.auto_close_seconds > 0 && (
              <p className="mt-5 text-sm text-[#7a6b5c]" aria-live="polite">
                המודעה תיסגר בעוד {remainingSeconds} שניות
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
