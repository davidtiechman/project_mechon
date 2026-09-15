"use client"

import { useEffect, useRef, useState } from "react"
import { getAssistantReply, type ChatMessage, type ReplyProvider } from "../lib/reply"

export function useAssistantChat(reply: ReplyProvider = getAssistantReply) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState("")
  const history = useRef<ChatMessage[]>([])
  const pending = useRef<AbortController | null>(null)
  const nextId = useRef(0)

  useEffect(() => () => pending.current?.abort(), [])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    history.current = [...history.current, { id: String(++nextId.current), role: "user", content }]
    setMessages(history.current)
    setError("")
    setIsTyping(true)
    try {
      const answer = await reply(history.current, { signal: controller.signal })
      if (controller.signal.aborted) return
      history.current = [...history.current, { id: String(++nextId.current), role: "assistant", content: answer }]
      setMessages(history.current)
    } catch {
      if (!controller.signal.aborted) setError("לא הצלחנו להציג תשובה. אפשר לשלוח את ההודעה שוב.")
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setIsTyping(false)
      }
    }
  }

  return { messages, isTyping, error, send }
}
