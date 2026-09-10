"use client"

import { MARKETING_CONSENT_TEXT, MARKETING_CONSENT_VERSION } from "@lib/marketing-consent"

export default function MarketingCheckbox({ checked, onChange, disabled = false, name, form }: {
  checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; name?: string; form?: string
}) {
  return (
    <div className="my-4 text-base leading-7">
      <label className="flex items-start gap-3">
        <input type="checkbox" name={name} form={form} checked={checked} disabled={disabled}
          onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#4a2d21]" />
        <span>{MARKETING_CONSENT_TEXT}</span>
      </label>
      <input type="hidden" name="marketing_consent_version" value={MARKETING_CONSENT_VERSION} form={form} />
      <p className="mt-2 text-sm text-ui-fg-subtle">
        ההצטרפות אינה חובה ואינה תנאי לרכישה או לפתיחת חשבון. ניתן לבטל בכל עת ב<a className="underline" href="/il/marketing-preferences" target="_blank" rel="noopener noreferrer">העדפות הדיוור</a>.
      </p>
    </div>
  )
}
