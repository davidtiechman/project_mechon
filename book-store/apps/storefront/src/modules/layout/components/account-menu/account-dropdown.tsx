"use client"

import { Transition } from "@headlessui/react"
import { signout } from "@lib/data/customer"
import { HEADER_MENU_GROUP, useHoverMenu } from "@lib/hooks/use-hover-menu"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { useParams, usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react"

export type AccountSummary = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  /** Google profile picture, saved on Google login */
  avatarUrl?: string | null
} | null

/** Google photo when there is one, otherwise the first letter on brown. */
function AvatarFace({ initial, avatarUrl, onError, hoverable = false }: {
  initial: string
  avatarUrl?: string | null
  onError: () => void
  hoverable?: boolean
}) {
  if (avatarUrl) {
    return (
      <span className="relative block h-full w-full overflow-hidden rounded-full bg-[#4a2d21]">
        <Image src={avatarUrl} alt="" fill sizes="44px" unoptimized className="object-cover" onError={onError} referrerPolicy="no-referrer" />
      </span>
    )
  }

  return (
    <span className={`grid h-full w-full place-items-center rounded-full bg-[#4a2d21] font-bold leading-none text-white transition-colors ${hoverable ? "text-xs medium:text-lg group-hover:bg-[#60432f]" : "text-lg"}`}>
      {initial}
    </span>
  )
}

const circleClass =
  "relative grid aspect-square h-7 w-7 min-w-[1.75rem] medium:h-10 medium:w-10 medium:min-w-[2.5rem] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors medium:border-2"

export function AccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 medium:h-5 medium:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function GuestCircle() {
  return (
    <span className={`${circleClass} border-[#d6c8ba] bg-[#fffaf5] text-[#4a2d21] hover:border-[#9a7130] hover:bg-[#f3ebe3]`}>
      <AccountIcon />
    </span>
  )
}

/** First letter of the first name, like a Google account avatar. */
function initialOf(account: NonNullable<AccountSummary>) {
  const source = account.firstName?.trim() || account.lastName?.trim() || account.email?.trim() || ""
  return Array.from(source)[0]?.toLocaleUpperCase("he") || ""
}

function fullNameOf(account: NonNullable<AccountSummary>) {
  return [account.firstName, account.lastName].map((part) => part?.trim()).filter(Boolean).join(" ")
}

const linkClass =
  "flex items-center rounded-md px-3 py-2.5 text-base text-[#4b3c2c] transition-colors hover:bg-[#f3ebe3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a7130]"

export default function AccountDropdown({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // If Google's picture fails to load, fall back to the letter everywhere
  const [avatarFailed, setAvatarFailed] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLAnchorElement>(null)
  const pathname = usePathname()
  const { countryCode } = useParams() as { countryCode: string }

  const hover = useHoverMenu(() => setOpen(true), () => {
    if (!panel.current?.contains(document.activeElement)) setOpen(false)
  }, { group: HEADER_MENU_GROUP, closeImmediately: () => setOpen(false) })

  // Close after navigating to another page
  useEffect(() => setOpen(false), [pathname])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpen(false)
      trigger.current?.focus()
    }
  }

  const handleSignout = async () => {
    setSigningOut(true)
    await signout(countryCode)
  }

  const initial = account ? initialOf(account) : ""
  const avatarUrl = !avatarFailed ? account?.avatarUrl : null
  const fullName = account ? fullNameOf(account) : ""
  const label = account ? `החשבון של ${fullName || account.email || "המשתמש"}` : "החשבון שלי"

  return (
    <div
      className="relative flex h-full shrink-0 items-center"
      onPointerEnter={hover.onPointerEnter}
      onPointerLeave={hover.onPointerLeave}
      onFocusCapture={() => { hover.onFocusCapture(); setOpen(true) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={handleKeyDown}
    >
      <LocalizedClientLink
        ref={trigger}
        href="/account"
        className="flex h-full shrink-0 items-center"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="nav-account-dropdown-panel"
        data-testid="nav-account-link"
      >
        {account && (initial || avatarUrl) ? (
          <span className={`${circleClass} group border-[#d6c8ba] bg-white p-[2px] hover:border-[#9a7130] medium:p-[3px]`}>
            <AvatarFace initial={initial} avatarUrl={avatarUrl} onError={() => setAvatarFailed(true)} hoverable />
          </span>
        ) : (
          <GuestCircle />
        )}
      </LocalizedClientLink>

      <Transition
        show={open}
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
      >
        <div
          ref={panel}
          id="nav-account-dropdown-panel"
          role="region"
          aria-label="תפריט החשבון"
          className="absolute left-0 top-full z-[60] -mt-2 w-72 rounded-lg border border-[#dfd0c0] bg-[#faf6f1] p-2 text-right text-[#352820] shadow-xl"
          data-testid="nav-account-dropdown"
          dir="rtl"
        >
          {account ? (
            <>
              <div className="flex items-center gap-3 border-b border-[#dfd0c0] px-3 pb-3 pt-2">
                <span className="grid aspect-square h-10 w-10 shrink-0 rounded-full border-2 border-[#d6c8ba] bg-white p-[3px]" aria-hidden="true">
                  <AvatarFace initial={initial} avatarUrl={avatarUrl} onError={() => setAvatarFailed(true)} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <strong className="truncate text-base font-semibold text-[#4a2d21]">{fullName || "שלום!"}</strong>
                  {account.email && <span className="truncate text-sm text-[#75685b]" dir="ltr">{account.email}</span>}
                </span>
              </div>
              <ul className="flex flex-col py-1">
                <li><LocalizedClientLink href="/account" className={linkClass}>סקירת החשבון</LocalizedClientLink></li>
                <li><LocalizedClientLink href="/account/orders" className={linkClass}>ההזמנות שלי</LocalizedClientLink></li>
                <li><LocalizedClientLink href="/account/profile" className={linkClass}>פרטים אישיים</LocalizedClientLink></li>
                <li><LocalizedClientLink href="/account/addresses" className={linkClass}>כתובות</LocalizedClientLink></li>
              </ul>
              <div className="border-t border-[#dfd0c0] pt-1">
                <button
                  type="button"
                  onClick={handleSignout}
                  disabled={signingOut}
                  className={`${linkClass} w-full text-[#9b3025] disabled:opacity-60`}
                  data-testid="nav-account-logout"
                >
                  {signingOut ? "מתנתק…" : "התנתקות"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 p-3">
              <p className="text-base text-[#4b3c2c]">היכנסו כדי לראות הזמנות, כתובות ופרטים אישיים.</p>
              <LocalizedClientLink
                href="/account"
                className="flex h-11 items-center justify-center rounded-md bg-[#4a2d21] px-4 text-base font-semibold text-white transition-colors hover:bg-[#8a5a3c]"
              >
                התחברות או הרשמה
              </LocalizedClientLink>
            </div>
          )}
        </div>
      </Transition>
    </div>
  )
}
