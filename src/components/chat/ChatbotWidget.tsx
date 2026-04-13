import { useStore } from "@nanostores/react"
import { useState, useRef, useEffect, useCallback } from "react"
import {
  isChatOpen, isChatLoading, chatMessages,
  toggleChat, addMessage, clearChat,
  type ChatMessage,
} from "../../store/chatStore"

const API = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:4000/api/store/chat"
  : "https://api.ladocristao.com.br/api/store/chat"

const WELCOME_MSG = "Oi! Sou a Bia, sua atendente virtual da Lado Cristao. Como posso te ajudar hoje?"
const TYPING_DELAY_MS = 10000 // 10 seconds before showing response
const CHAR_DELAY_MS = 25 // 25ms per character for typewriter

export default function ChatbotWidget() {
  const open = useStore(isChatOpen)
  const loading = useStore(isChatLoading)
  const messages = useStore(chatMessages)
  const [input, setInput] = useState("")
  const [typingText, setTypingText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, typingText, loading])

  // Focus input when chat opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  // Typewriter effect
  const typeResponse = useCallback((text: string) => {
    setIsTyping(true)
    setTypingText("")
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypingText(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setIsTyping(false)
        setTypingText("")
        addMessage("assistant", text)
      }
    }, CHAR_DELAY_MS)
    return () => clearInterval(interval)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || isTyping) return

    setInput("")
    addMessage("user", text)
    isChatLoading.set(true)

    try {
      // Build history for API (last 10 messages)
      const history = chatMessages.get().slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      // Check if user provided email + CPF in recent messages
      const recentTexts = chatMessages.get().slice(-6).map(m => m.content).join(" ")
      const emailMatch = recentTexts.match(/[\w.-]+@[\w.-]+\.\w+/)
      const cpfMatch = recentTexts.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)
      const context = emailMatch && cpfMatch
        ? { email: emailMatch[0], cpf: cpfMatch[0] }
        : undefined

      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, context, sessionId: localStorage.getItem("tess_vid") || "" }),
      })

      const data = await res.json()
      const reply = data.reply || "Desculpe, tive um probleminha. Tenta de novo?"

      // Delay before showing response (human feel)
      const delay = TYPING_DELAY_MS + Math.random() * 2000
      setTimeout(() => {
        isChatLoading.set(false)
        typeResponse(reply)
      }, delay)
    } catch {
      isChatLoading.set(false)
      addMessage("assistant", "Ops, nao consegui me conectar. Tenta novamente em instantes!")
    }
  }, [input, loading, isTyping, typeResponse])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Show welcome message if no history
  const displayMessages = messages.length === 0 && !open
    ? []
    : messages

  const showWelcome = open && messages.length === 0 && !loading && !isTyping

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-24 sm:bottom-6 right-6 z-[9997] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open ? "bg-slate-600 rotate-0 scale-90" : "bg-slate-900 hover:bg-slate-800 hover:scale-105"
        }`}
        aria-label={open ? "Fechar chat" : "Abrir chat"}
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white"></span>
          </>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-40 sm:bottom-24 right-4 sm:right-6 z-[9997] w-[360px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ maxHeight: "min(600px, calc(100vh - 180px))" }}>
          {/* Header */}
          <div className="bg-slate-900 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-white text-sm font-black">B</div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">Bia</p>
                <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block"></span>
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button onClick={clearChat} className="text-slate-500 hover:text-white transition-colors p-1" title="Limpar conversa">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              )}
              <button onClick={toggleChat} className="text-slate-500 hover:text-white transition-colors p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50" style={{ minHeight: "200px" }}>
            {/* Welcome message */}
            {showWelcome && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-slate-900 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">B</div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed">{WELCOME_MSG}</p>
                </div>
              </div>
            )}

            {/* Chat messages */}
            {displayMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 bg-slate-900 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">B</div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-tr-sm"
                    : "bg-white text-slate-700 rounded-tl-sm shadow-sm border border-slate-100"
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Typing indicator (during delay) */}
            {loading && !isTyping && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-slate-900 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">B</div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 mr-1">Bia esta digitando</span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}

            {/* Typewriter text */}
            {isTyping && typingText && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-slate-900 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">B</div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] shadow-sm border border-slate-100">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{typingText}<span className="inline-block w-0.5 h-4 bg-slate-400 ml-0.5 animate-pulse align-text-bottom"></span></p>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 px-4 py-3 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                disabled={loading || isTyping}
                maxLength={500}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || isTyping}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl p-2.5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
            <p className="text-[9px] text-slate-300 text-center mt-1.5">Bia e uma assistente virtual com IA</p>
          </div>
        </div>
      )}
    </>
  )
}
