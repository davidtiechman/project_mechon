"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import useToggleState from "@lib/hooks/use-toggle-state"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { Fragment } from "react"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { Locale } from "@lib/data/locales"
import { instituteProjects } from "@lib/data/institute-projects"
import { ActiveCatalog } from "@lib/data/site-content"


const SideMenuItems = {
  "דף הבית": "/",
  "חנות הספרים": "/store",
  "החשבון שלי": "/account",
  "סל הקניות": "/cart",
}

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  catalog: ActiveCatalog | null
}

const SideMenu = ({ regions, locales, currentLocale, catalog }: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
                  className="relative h-full flex items-center transition-all ease-out duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:text-ui-fg-base"
                >
                  תפריט
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/0 pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100 backdrop-blur-2xl"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 backdrop-blur-2xl"
                leaveTo="opacity-0"
              >
                <PopoverPanel className="absolute inset-x-0 z-[51] m-2 flex h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-sm flex-col text-sm text-ui-fg-on-color backdrop-blur-2xl sm:inset-x-auto sm:start-0">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col h-full bg-[rgba(3,7,18,0.5)] rounded-rounded justify-between p-6"
                  >
                    <div className="flex justify-end" id="xmark">
                      <button type="button" aria-label="סגירת תפריט" data-testid="close-menu-button" onClick={close}>
                        <span aria-hidden="true"><XMark /></span>
                      </button>
                    </div>
                    <ul className="flex min-h-0 flex-col items-start justify-start gap-6 overflow-y-auto py-2">
                      {Object.entries(SideMenuItems).map(([name, href]) => {
                        return (
                          <li key={name}>
                            <LocalizedClientLink
                              href={href}
                              className="text-3xl leading-10 hover:text-ui-fg-disabled"
                              onClick={close}
                              data-testid={`${name.toLowerCase()}-link`}
                            >
                              {name}
                            </LocalizedClientLink>
                          </li>
                        )
                      })}
                      {instituteProjects.map((project) => (
                        <li key={project.slug}>
                          <LocalizedClientLink
                            href={`/brands/${project.slug}`}
                            className="text-3xl leading-10 hover:text-ui-fg-disabled"
                            onClick={close}
                          >
                            {project.title}
                          </LocalizedClientLink>
                        </li>
                      ))}
                      <li>
                        {catalog ? <a href={catalog.file_url} download={catalog.file_name} onClick={close} className="inline-flex max-w-full whitespace-normal rounded-md border border-white/70 px-4 py-2 text-center text-xl hover:bg-white hover:text-[#3b352a]">קטלוג להורדה</a> : <span aria-disabled="true" className="inline-flex max-w-full cursor-not-allowed whitespace-normal rounded-md border border-white/40 px-4 py-2 text-center text-xl opacity-60">הקטלוג יעלה בקרוב</span>}
                      </li>
                    </ul>
                    <div className="flex flex-col gap-y-6">
                      {!!locales?.length && (
                        <div
                          className="flex justify-between"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="flex justify-between txt-compact-small">
                        © {new Date().getFullYear()} מכון מעשה רוקח. כל הזכויות שמורות. האתר מופעל על ידי מעשה רוקח בע&quot;מ.
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
