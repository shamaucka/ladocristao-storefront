import { atom } from "nanostores"
import { persistentAtom } from "@nanostores/persistent"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export const isChatOpen = atom(false)
export const isChatLoading = atom(false)

export const chatMessages = persistentAtom<ChatMessage[]>("tess_chat_history", [], {
  encode: JSON.stringify,
  decode: (s) => {
    try {
      const msgs = JSON.parse(s)
      // Keep max 50 messages
      return Array.isArray(msgs) ? msgs.slice(-50) : []
    } catch { return [] }
  },
})

export function toggleChat() { isChatOpen.set(!isChatOpen.get()) }
export function openChat() { isChatOpen.set(true) }
export function closeChat() { isChatOpen.set(false) }

export function addMessage(role: "user" | "assistant", content: string): ChatMessage {
  const msg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: Date.now(),
  }
  const msgs = [...chatMessages.get(), msg].slice(-50)
  chatMessages.set(msgs)
  return msg
}

export function clearChat() { chatMessages.set([]) }
