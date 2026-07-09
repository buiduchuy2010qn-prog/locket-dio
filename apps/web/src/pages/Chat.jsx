import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import Avatar from '../components/Avatar'
import { timeAgo } from '../utils/storage'

export default function Chat() {
  const { user, toast } = useApp()
  const [conversations, setConversations] = useState([])
  const [peer, setPeer] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  const loadConvos = () =>
    api.fetchConversations()
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))

  useEffect(() => {
    loadConvos()
  }, [])

  useEffect(() => {
    if (!peer) return
    api.fetchMessages(peer.peerId || peer.id)
      .then(setMessages)
      .catch(() => setMessages([]))
  }, [peer])

  const openPeer = (c) => {
    setPeer({ peerId: c.peerId, ...c.user, id: c.peerId })
  }

  const send = async () => {
    if (!text.trim() || !peer) return
    try {
      const m = await api.sendMessage(peer.peerId || peer.id, text)
      setMessages((prev) => [...prev, m])
      setText('')
      loadConvos()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (peer) {
    return (
      <div className="px-4 max-w-lg mx-auto page-enter flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800">
          <button type="button" onClick={() => setPeer(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={18} />
          </button>
          <Avatar user={peer} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{peer.displayName || peer.username}</p>
            <p className="text-[11px] text-slate-400">@{peer.username}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3 space-y-2 custom-scroll">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">Chưa có tin nhắn — gửi lời chào!</p>
          )}
          {messages.map((m) => {
            const mine = m.fromId === user?.id
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    mine ? 'gold-gradient text-white rounded-br-md' : 'bg-slate-100 dark:bg-slate-800 rounded-bl-md'
                  }`}
                >
                  <p>{m.body}</p>
                  <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-slate-400'}`}>{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 py-3 border-t border-slate-100 dark:border-slate-800">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Nhập tin nhắn…"
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button type="button" onClick={send} className="w-11 h-11 rounded-xl gold-gradient text-white flex items-center justify-center active:scale-95">
            <Send size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 max-w-lg mx-auto page-enter py-4">
      <h1 className="text-2xl font-extrabold flex items-center gap-2">
        <MessageCircle className="text-amber-500" size={24} /> Messages
      </h1>
      <p className="text-sm text-slate-500 mt-1 mb-4">Chat với bạn bè đã kết nối (lưu trên thiết bị)</p>

      {loading && <p className="text-sm text-slate-400 py-8 text-center">Đang tải…</p>}

      {!loading && conversations.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-slate-500">Chưa có hội thoại. Thêm bạn bè trước.</p>
          <Link to="/app/friends" className="inline-block px-5 py-2.5 rounded-xl gold-gradient text-white text-sm font-bold">
            Tìm bạn bè
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {conversations.map((c) => (
          <button
            key={c.peerId}
            type="button"
            onClick={() => openPeer(c)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-amber-200 active:scale-[0.99] transition text-left"
          >
            <Avatar user={c.user} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{c.user?.displayName || c.user?.username}</p>
              <p className="text-xs text-slate-400 truncate">{c.lastMessage || 'Bắt đầu chat…'}</p>
            </div>
            {c.lastAt && <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(c.lastAt)}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
