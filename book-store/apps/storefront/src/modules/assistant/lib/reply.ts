export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

export type ReplyProvider = (
  messages: readonly ChatMessage[],
  options: { signal: AbortSignal }
) => Promise<string>

export const PLACEHOLDER_REPLY =
  "שלום! אני אהרן הידען. השירות עדיין בהקמה ובעז״ה אהיה זמין כאן בקרוב כדי לעזור לכם למצוא ספרים ולקבל מידע על החנות."

// Replace this provider with a POST to /api/assistant/chat when the service is ready.
// The UI and conversation hook depend only on ReplyProvider, not on its transport.
export const getAssistantReply: ReplyProvider = async (_messages, { signal }) => {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, 900)
    signal.addEventListener("abort", abort, { once: true })
  })
  return PLACEHOLDER_REPLY
}
