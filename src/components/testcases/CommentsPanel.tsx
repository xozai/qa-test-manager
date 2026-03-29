import { useState, useEffect, useRef } from 'react'
import { Loader2, Send, MessageSquare, GitCommit } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Comment, ActivityEvent, User } from '../../types'

interface CommentsPanelProps {
  testCaseId: string
  users: User[]
  onFetchComments: (testCaseId: string) => Promise<{ comments: Comment[]; activity: ActivityEvent[] }>
  onAddComment: (testCaseId: string, body: string) => Promise<void>
}

const ACTION_LABELS: Record<string, string> = {
  created:        'created this test case',
  edited:         'edited this test case',
  status_changed: 'changed the status',
  moved:          'moved to a different suite',
  duplicated:     'duplicated this test case',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

type TimelineItem =
  | { kind: 'comment';  data: Comment;       ts: string }
  | { kind: 'activity'; data: ActivityEvent; ts: string }

export default function CommentsPanel({ testCaseId, users, onFetchComments, onAddComment }: CommentsPanelProps) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))

  function buildTimeline(comments: Comment[], activity: ActivityEvent[]): TimelineItem[] {
    const all: TimelineItem[] = [
      ...comments.map(c => ({ kind: 'comment'  as const, data: c, ts: c.createdAt })),
      ...activity.map(a => ({ kind: 'activity' as const, data: a, ts: a.createdAt })),
    ]
    return all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  }

  async function load() {
    setLoading(true)
    const { comments, activity } = await onFetchComments(testCaseId)
    setItems(buildTimeline(comments, activity))
    setLoading(false)
  }

  useEffect(() => {
    void load()

    // Realtime subscriptions for this test case
    const channel = supabase
      .channel(`comments-${testCaseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments',      filter: `test_case_id=eq.${testCaseId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log',  filter: `test_case_id=eq.${testCaseId}` }, () => void load())
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [testCaseId])

  async function handlePost() {
    if (!body.trim()) return
    setPosting(true)
    await onAddComment(testCaseId, body.trim())
    setBody('')
    setPosting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-sm text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" />Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Timeline */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm text-zinc-500">No comments or activity yet</p>
          </div>
        )}
        {items.map(item => {
          if (item.kind === 'comment') {
            const c = item.data
            const author = c.authorId ? (userMap[c.authorId] ?? 'Unknown') : 'Unknown'
            const initial = author[0]?.toUpperCase() ?? '?'
            return (
              <div key={c.id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{author}</span>
                    <span className="text-[11px] text-zinc-400">{timeAgo(c.createdAt)}</span>
                  </div>
                  <div className="mt-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl rounded-tl-none text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {c.body}
                  </div>
                </div>
              </div>
            )
          } else {
            const a = item.data
            const actor = a.actorId ? (userMap[a.actorId] ?? 'Someone') : 'Someone'
            return (
              <div key={a.id} className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 pl-1">
                <GitCommit className="w-3.5 h-3.5 flex-shrink-0" />
                <span><span className="font-medium text-zinc-500 dark:text-zinc-400">{actor}</span> {ACTION_LABELS[a.action] ?? a.action}</span>
                <span className="ml-auto flex-shrink-0">{timeAgo(a.createdAt)}</span>
              </div>
            )
          }
        })}
      </div>

      {/* Comment entry */}
      <div className="flex-shrink-0 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handlePost() }}
            placeholder="Add a comment… (⌘↵ to post)"
            rows={2}
            className="flex-1 px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <button
            onClick={() => void handlePost()}
            disabled={!body.trim() || posting}
            className="self-end p-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
