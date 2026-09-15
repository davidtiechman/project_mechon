"use client"

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import Image from "next/image"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { useAssistantChat } from "../hooks/use-assistant-chat"

function Avatar() {
  return (
    <span className="relative block h-20 w-24 shrink-0">
      <Image src="/images/aharon-hayadan-transparent.png" alt="" fill sizes="96px" className="object-contain" />
    </span>
  )
}

export default function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const launcher = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = useState("")
  const { messages, isTyping, error, send } = useAssistantChat()
  const id = useId()
  const transcript = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, isTyping, open])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || isTyping) return
    void send(draft)
    setDraft("")
    input.current?.focus()
  }

  return (
    <>
      <div className={`fixed left-4 bottom-[calc(10.5rem+env(safe-area-inset-bottom))] z-[60] max-w-[calc(100vw-2rem)] lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] ${minimized ? "w-20 lg:w-24" : "w-56 lg:w-[360px]"}`}>
      {!minimized && (
        <button
          type="button"
          aria-label="מזעור אהרן הידען והסתרת הודעת הפתיחה"
          onClick={() => {
            setMinimized(true)
            launcher.current?.focus()
          }}
          className="absolute -top-8 right-0 z-10 flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 text-3xl text-[#4b3c2c] hover:text-[#7b552e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7b552e]"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתיחת הצ׳אט עם אהרן הידען"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-dialog` : undefined}
        className="block w-full border-0 bg-transparent p-0 motion-safe:transition-transform motion-safe:hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b552e]"
      >
        <Image
          src={minimized ? "/images/aharon-hayadan-transparent.png" : "/images/aharon-hayadan-welcome.png"}
          alt=""
          width={minimized ? 1168 : 1369}
          height={minimized ? 1346 : 1149}
          sizes={minimized ? "(min-width: 1024px) 96px, 80px" : "(min-width: 1024px) 360px, 224px"}
          className="block h-auto w-full object-contain"
        />
      </button>
      </div>

      <Dialog open={open} onClose={setOpen} className="relative z-[75]" dir="rtl">
        <div className="fixed inset-0 bg-[#2d1c16]/20" aria-hidden="true" />
        <div className="fixed inset-0 flex items-end justify-start p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
          <DialogPanel
            id={`${id}-dialog`}
            className="flex h-[min(620px,calc(100dvh-1.5rem))] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[#dfd0c0] bg-[#faf6f1] text-right text-[#4b3c2c] shadow-2xl sm:mr-auto sm:ml-0 sm:w-[400px] sm:max-h-[calc(100dvh-2.5rem)]"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-[#dfd0c0] bg-[#f1e7da] px-4 py-3">
              <Avatar />
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-bold">אהרן הידען</DialogTitle>
                <p className="text-sm text-[#75634e]">כאן בשביל הספר הבא שלך</p>
              </div>
              <button data-autofocus type="button" onClick={() => setOpen(false)} aria-label="סגירת הצ׳אט" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-[#e5d5c2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7b552e]">
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
              <p className="mb-5 text-center text-sm leading-6 text-[#75634e]">ברוכים הבאים! השירות בהקמה.<br />בינתיים אפשר לשלוח הודעה ולהכיר את אהרן.</p>
              <div role="log" aria-label="השיחה עם אהרן הידען" aria-live="polite" aria-relevant="additions" className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-base leading-7 [overflow-wrap:anywhere] ${message.role === "user" ? "rounded-tr-sm bg-[#60432f] text-white" : "rounded-tl-sm border border-[#e1d4c4] bg-white text-[#4b3c2c]"}`}>
                      <span className="sr-only">{message.role === "user" ? "אתם: " : "אהרן הידען: "}</span>
                      <span dir="auto">{message.content}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-[#75634e]">
                {isTyping && <span className="flex items-center gap-2"><span aria-hidden="true" className="motion-safe:animate-pulse">•••</span>אהרן הידען מקליד…</span>}
              </div>
              {error && <p role="alert" className="mt-2 text-sm text-[#9b3025]">{error}</p>}
            </div>

            <form onSubmit={submit} className="shrink-0 border-t border-[#dfd0c0] bg-white p-4">
              <label htmlFor={`${id}-message`} className="sr-only">ההודעה שלכם לאהרן הידען</label>
              <div className="flex items-end gap-2">
                <textarea
                  ref={input}
                  id={`${id}-message`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                  placeholder="מה תרצו לשאול?"
                  rows={2}
                  maxLength={2000}
                  dir="auto"
                  aria-describedby={`${id}-hint`}
                  className="max-h-28 min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-[#c8b69f] bg-[#faf6f1] px-3 py-2 text-base leading-6 placeholder:text-[#75634e] focus:outline focus:outline-2 focus:outline-[#8a6f4d]"
                />
                <button type="submit" disabled={!draft.trim() || isTyping} className="min-h-12 shrink-0 rounded-xl bg-[#60432f] px-4 py-3 text-base font-semibold text-white hover:bg-[#4a2d21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7b552e] disabled:cursor-not-allowed disabled:opacity-50">שליחה</button>
              </div>
              <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-[#75634e]">Enter לשליחה · Shift+Enter לשורה חדשה</p>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
