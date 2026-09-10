"use client"

export default function AccountLoadError() {
  return (
    <div role="alert" className="flex flex-col gap-4 p-6" dir="rtl">
      <p>לא ניתן לטעון את פרטי החשבון כרגע. נסו שוב בעוד רגע.</p>
      <button
        type="button"
        className="self-start rounded-md border px-4 py-2"
        onClick={() => window.location.reload()}
      >
        נסו שוב
      </button>
    </div>
  )
}
