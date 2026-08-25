"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useState } from "react"

const STORAGE_KEY = "mechon_accessibility_preferences"
const MIN_TEXT_SCALE = 0.9
const MAX_TEXT_SCALE = 1.3
const TEXT_STEP = 0.1

type AccessibilityPreferences = {
  textScale: number
  highContrast: boolean
  highlightLinks: boolean
  reduceMotion: boolean
}

const defaultPreferences: AccessibilityPreferences = {
  textScale: 1,
  highContrast: false,
  highlightLinks: false,
  reduceMotion: false,
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement
  root.style.fontSize = `${Math.round(preferences.textScale * 100)}%`
  root.dataset.a11yContrast = String(preferences.highContrast)
  root.dataset.a11yLinks = String(preferences.highlightLinks)
  root.dataset.a11yMotion = String(preferences.reduceMotion)
}

export default function AccessibilityMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AccessibilityPreferences>
        const restored = {
          textScale:
            typeof parsed.textScale === "number" &&
            parsed.textScale >= MIN_TEXT_SCALE &&
            parsed.textScale <= MAX_TEXT_SCALE
              ? parsed.textScale
              : 1,
          highContrast: parsed.highContrast === true,
          highlightLinks: parsed.highlightLinks === true,
          reduceMotion: parsed.reduceMotion === true,
        }
        setPreferences(restored)
        applyPreferences(restored)
      } else {
        applyPreferences(defaultPreferences)
      }
    } catch {
      applyPreferences(defaultPreferences)
    } finally {
      setIsReady(true)
    }
  }, [])

  const updatePreferences = (
    update: (current: AccessibilityPreferences) => AccessibilityPreferences,
  ) => {
    setPreferences((current) => {
      const next = update(current)
      applyPreferences(next)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // The preference still applies for the current page if storage is unavailable.
      }
      return next
    })
  }

  const changeTextScale = (direction: -1 | 1) => {
    updatePreferences((current) => ({
      ...current,
      textScale: Math.min(
        MAX_TEXT_SCALE,
        Math.max(
          MIN_TEXT_SCALE,
          Math.round((current.textScale + direction * TEXT_STEP) * 10) / 10,
        ),
      ),
    }))
  }

  const reset = () => {
    updatePreferences(() => defaultPreferences)
  }

  return (
    <>
      <button
        type="button"
        aria-label="אפשרויות נגישות"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-[70] flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-[#d8bf86] bg-[#2d1c16] text-[#f8f2e6] shadow-[0_6px_20px_rgba(45,28,22,0.28)] transition-colors hover:bg-[#4a2d21] focus-visible:ring-2 focus-visible:ring-[#8a682d] focus-visible:ring-offset-2"
        data-testid="accessibility-menu-button"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="16" cy="16" r="13" />
          <circle cx="16" cy="9" r="2" fill="currentColor" stroke="none" />
          <path d="M9.5 13.2c4.3 1.5 8.7 1.5 13 0" />
          <path d="M16 13.8v5.1" />
          <path d="m16 18.2-4.5 7" />
          <path d="m16 18.2 4.5 7" />
        </svg>
      </button>

      <Dialog open={isOpen} onClose={setIsOpen} className="relative z-[80]" dir="rtl">
        <div className="fixed inset-0 bg-black/35" aria-hidden="true" />
        <div className="fixed inset-0 flex items-end justify-start p-4 small:items-center small:justify-center">
          <DialogPanel className="w-full max-w-sm rounded-lg border border-[#ddcec0] bg-white p-5 text-[#262117] shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-xl font-semibold">אפשרויות נגישות</DialogTitle>
              <button
                type="button"
                aria-label="סגירת אפשרויות נגישות"
                onClick={() => setIsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-xl focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <fieldset>
                <legend className="font-semibold">גודל טקסט</legend>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => changeTextScale(-1)}
                    disabled={!isReady || preferences.textScale <= MIN_TEXT_SCALE}
                    className="accessibility-option-button"
                    aria-label="הקטנת טקסט"
                  >
                    א−
                  </button>
                  <output aria-live="polite" className="min-w-14 text-center">
                    {Math.round(preferences.textScale * 100)}%
                  </output>
                  <button
                    type="button"
                    onClick={() => changeTextScale(1)}
                    disabled={!isReady || preferences.textScale >= MAX_TEXT_SCALE}
                    className="accessibility-option-button"
                    aria-label="הגדלת טקסט"
                  >
                    א+
                  </button>
                </div>
              </fieldset>

              <ToggleButton
                pressed={preferences.highContrast}
                onClick={() => updatePreferences((current) => ({ ...current, highContrast: !current.highContrast }))}
              >
                ניגודיות מוגברת
              </ToggleButton>
              <ToggleButton
                pressed={preferences.highlightLinks}
                onClick={() => updatePreferences((current) => ({ ...current, highlightLinks: !current.highlightLinks }))}
              >
                הדגשת קישורים
              </ToggleButton>
              <ToggleButton
                pressed={preferences.reduceMotion}
                onClick={() => updatePreferences((current) => ({ ...current, reduceMotion: !current.reduceMotion }))}
              >
                צמצום אנימציות
              </ToggleButton>

              <button type="button" onClick={reset} className="accessibility-menu-row">
                איפוס הגדרות הנגישות
              </button>

              <LocalizedClientLink
                href="/pages/accessibility"
                onClick={() => setIsOpen(false)}
                className="accessibility-menu-row underline underline-offset-4"
              >
                מעבר להצהרת הנגישות
              </LocalizedClientLink>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="accessibility-menu-row"
    >
      <span>{children}</span>
      <span aria-hidden="true" className={pressed ? "font-bold" : "text-gray-500"}>
        {pressed ? "פעיל" : "כבוי"}
      </span>
    </button>
  )
}
