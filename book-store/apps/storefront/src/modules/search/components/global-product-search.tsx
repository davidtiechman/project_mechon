"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { DEFAULT_STORE_SEARCH_DEBOUNCE_MS, MIN_STORE_SEARCH_LENGTH } from "@lib/constants/store"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useId, useRef, useState } from "react"

type SearchResult = {
  id: string
  handle: string
  title: string
  details: string
  thumbnail?: string
  price: string | null
}

const configuredDebounce = Number.parseInt(
  process.env.NEXT_PUBLIC_STORE_SEARCH_DEBOUNCE_MS || "",
  10
)
const SEARCH_DEBOUNCE_MS = Number.isFinite(configuredDebounce)
  ? Math.max(configuredDebounce, 100)
  : DEFAULT_STORE_SEARCH_DEBOUNCE_MS

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

function SearchBox({
  countryCode,
  tone,
  autoFocus = false,
  onNavigate,
}: {
  countryCode: string
  tone: "hero" | "dialog"
  autoFocus?: boolean
  onNavigate?: () => void
}) {
  const router = useRouter()
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle")
  const [settledQuery, setSettledQuery] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const trimmedQuery = query.trim()
    const requestId = ++requestIdRef.current
    if (trimmedQuery.length < MIN_STORE_SEARCH_LENGTH) {
      setResults([])
      setTotal(0)
      setSettledQuery("")
      setRequestStatus("idle")
      return
    }

    const controller = new AbortController()
    setRequestStatus("pending")
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/product-search?countryCode=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error("Search failed")
        const data = (await response.json()) as { results: SearchResult[]; total: number }
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        setResults(data.results)
        setTotal(data.total)
        setSettledQuery(trimmedQuery)
        setRequestStatus("success")
        setOpen(true)
      } catch (error) {
        if (
          (error as Error).name !== "AbortError" &&
          requestId === requestIdRef.current
        ) {
          setRequestStatus("error")
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [countryCode, query])

  const trimmedQuery = query.trim()
  const currentQuerySettled =
    requestStatus === "success" && settledQuery === trimmedQuery
  const initialSearchPending =
    trimmedQuery.length >= MIN_STORE_SEARCH_LENGTH &&
    results.length === 0 &&
    !currentQuerySettled &&
    requestStatus !== "error"
  const hasDropdownContent = results.length > 0 || currentQuerySettled

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsideClick)
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick)
  }, [])

  const allResultsHref = `/store?search=${encodeURIComponent(query.trim())}`
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setOpen(false)
    onNavigate?.()
    router.push(`/${countryCode}${allResultsHref}`)
  }

  return (
    <div ref={rootRef} className="relative w-full" dir="rtl">
      <form role="search" onSubmit={submit}>
        <label htmlFor={`${id}-input`} className="sr-only">חיפוש ספרים</label>
        <div className="relative">
          <SearchIcon className={`pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 ${tone === "hero" ? "text-[#7b5636]" : "text-[#8a7968]"}`} />
          <input
            id={`${id}-input`}
            type="search"
            value={query}
            autoFocus={autoFocus}
            autoComplete="off"
            placeholder="איזה ספר אתה מחפש?"
            onFocus={() => query.trim().length >= MIN_STORE_SEARCH_LENGTH && setOpen(true)}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setOpen(event.currentTarget.value.trim().length >= MIN_STORE_SEARCH_LENGTH)
            }}
            onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-results`}
            className={`h-14 w-full rounded-md border py-3 pl-12 pr-12 text-base text-[#352820] shadow-lg outline-none transition placeholder:text-[#8d7c6c] focus:ring-2 ${tone === "hero" ? "border-[#d8bf86]/70 bg-[#fffaf2] focus:border-[#d8bf86] focus:ring-[#d8bf86]/30" : "border-[#d6c8ba] bg-white focus:border-[#8a6f4d] focus:ring-[#8a6f4d]/20"}`}
          />
          {initialSearchPending && (
            <span className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#b9a58f] border-t-[#68462f]" aria-label="מחפש" />
          )}
        </div>
      </form>

      {open && !initialSearchPending && hasDropdownContent && (
        <div id={`${id}-results`} className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-lg border border-[#d9cab9] bg-[#fffdf9] text-[#352820] shadow-2xl" role="region" aria-live="polite" aria-label="תוצאות חיפוש">
          {results.length ? (
            <ul className="max-h-[min(420px,60vh)] overflow-y-auto py-1">
              {results.map((result) => (
                <li key={result.id}>
                  <LocalizedClientLink href={`/products/${result.handle}`} onClick={() => { setOpen(false); onNavigate?.() }} className="group flex min-h-[88px] items-center gap-3 border-b border-[#eee4da] px-3 py-2.5 text-right transition hover:bg-[#f5ede4] focus-visible:bg-[#f5ede4] focus-visible:outline-none">
                    <span className="relative h-[68px] w-[52px] shrink-0 overflow-hidden rounded-sm bg-[#f2e9df]">
                      {result.thumbnail ? <Image src={result.thumbnail} alt="" fill sizes="52px" className="object-contain" /> : <span className="grid h-full place-items-center text-xs text-[#9a8b7c]">ללא תמונה</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-base font-semibold text-[#3f3027]">{result.title}</strong>
                      {result.details && <span className="mt-1 block truncate text-sm text-[#78695c]">{result.details}</span>}
                    </span>
                    {result.price && <span className="shrink-0 text-sm font-semibold text-[#6b4a2e]">{result.price}</span>}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          ) : currentQuerySettled ? (
            <div className="px-4 py-6 text-center text-sm text-[#75685b]">לא נמצאו ספרים מתאימים.</div>
          ) : null}
          <LocalizedClientLink href={allResultsHref} onClick={() => { setOpen(false); onNavigate?.() }} className="flex items-center justify-center gap-2 bg-[#f0e4d7] px-4 py-3 text-sm font-semibold text-[#5b402b] transition hover:bg-[#e7d6c4]">
            הצג את כל התוצאות{total > 0 ? ` (${total})` : ""}
            <span aria-hidden="true">←</span>
          </LocalizedClientLink>
        </div>
      )}
    </div>
  )
}

export function HeroProductSearch({ countryCode }: { countryCode: string }) {
  return <div className="mt-7 max-w-[18rem]"><SearchBox countryCode={countryCode} tone="hero" /></div>
}

export function HeaderProductSearch({ countryCode }: { countryCode: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="פתיחת חיפוש ספרים" className="flex h-11 w-11 items-center justify-center rounded-full text-[#3b352a] transition hover:bg-[#ede2d7] hover:text-[#8a5a3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6f4d]/40">
        <SearchIcon className="h-6 w-6" />
      </button>
      <Dialog open={open} onClose={setOpen} className="relative z-[90]" dir="rtl">
        <div className="fixed inset-0 bg-[#261812]/45 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 pt-[max(6rem,env(safe-area-inset-top))]">
          <DialogPanel className="w-full max-w-2xl rounded-xl border border-[#d9cab9] bg-[#faf6f1] p-4 shadow-2xl small:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <DialogTitle className="text-2xl font-semibold text-[#3f3027]">חיפוש ספרים</DialogTitle>
              <button type="button" onClick={() => setOpen(false)} aria-label="סגירת החיפוש" className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-[#655548] hover:bg-[#eadfd4]">×</button>
            </div>
            <SearchBox countryCode={countryCode} tone="dialog" autoFocus onNavigate={() => setOpen(false)} />
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
