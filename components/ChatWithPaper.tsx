'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Bot, User } from 'lucide-react'
import { ChatMessage } from '@/lib/chat'
import { Paper } from '@/lib/types'

interface ChatWithPaperProps {
  paper: Paper
  onClose: () => void
}

const STORAGE_KEY = (paperId: string) => `consensus_chat_${paperId}`

function loadMessages(paperId: string): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(paperId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMessages(paperId: string, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY(paperId), JSON.stringify(messages))
}

const SUGGESTIONS = [
  'What is the main finding?',
  'What is the sample size?',
  'What are the limitations?',
  'Is this peer-reviewed?',
]

export default function ChatWithPaper({ paper, onClose }: ChatWithPaperProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(paper.paperId))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    saveMessages(paper.paperId, newMessages)
    setInput('')
    setLoading(true)
    setShowSuggestions(false)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperAbstract: paper.abstract || '',
          question: text.trim(),
          chatHistory: messages.filter(m => m.role === 'assistant'),
        }),
      })
      const data = await res.json()
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: data.answer || 'Sorry, I could not generate a response.',
        timestamp: Date.now(),
      }
      const finalMessages = [...newMessages, assistantMsg]
      setMessages(finalMessages)
      saveMessages(paper.paperId, finalMessages)
    } catch {
      const errMsg: ChatMessage = {
        id: `msg_${Date.now()}_e`,
        role: 'assistant',
        content: 'Failed to get a response. Please try again.',
        timestamp: Date.now(),
      }
      const finalMessages = [...newMessages, errMsg]
      setMessages(finalMessages)
      saveMessages(paper.paperId, finalMessages)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
        <MessageCircle className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-slate-700">Ask this paper</span>
        <span className="text-xs text-slate-400 truncate flex-1 ml-1">{paper.title}</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !showSuggestions && (
          <div className="text-center text-slate-400 text-sm mt-8">
            Ask a question about this paper...
          </div>
        )}

        {showSuggestions && messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 text-center">Suggested questions</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-full hover:bg-blue-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              msg.role === 'user' ? 'bg-blue-500' : 'bg-slate-200'
            }`}>
              {msg.role === 'user'
                ? <User className="w-3 h-3 text-white" />
                : <Bot className="w-3 h-3 text-slate-500" />
              }
            </div>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white rounded-tr-sm'
                : 'bg-slate-100 text-slate-700 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <Bot className="w-3 h-3 text-slate-500" />
            </div>
            <div className="bg-slate-100 text-slate-500 text-sm px-3 py-2 rounded-2xl rounded-tl-sm">
              Thinking...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this paper..."
            rows={1}
            className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 max-h-32 overflow-y-auto"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
