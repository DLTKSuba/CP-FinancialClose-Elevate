import { useCallback, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { Button } from './Button'
import { Input } from './Input'
import './DelaChatHistory.css'

/** Run states a close-period chat can report; tapping the tag steps through them. */
export type DelaChatStatus = 'Running' | 'Complete' | 'Needs Review'

export interface DelaChatHistoryEntry {
  id: string
  title: string
  askedOn: Date
  /** Present only on chats that kicked off a close run. */
  status?: DelaChatStatus
}

const STATUS_ORDER: DelaChatStatus[] = ['Running', 'Needs Review', 'Complete']

export const CLOSE_RUN_BADGE_VARIANT: Record<DelaChatStatus, 'info' | 'success' | 'warning'> = {
  Running: 'info',
  Complete: 'success',
  'Needs Review': 'warning',
}

export interface DelaChatHistoryProps {
  onBack: () => void
  /** Called with the past prompt when a chat is reopened from the list. */
  onSelect?: (entry: DelaChatHistoryEntry) => void
  /** Leaves unfinished background tasks out of the list; they live in Running Tasks instead. */
  excludeRunning?: boolean
  /** Fires after any edit so callers can refresh counts derived from the session list. */
  onEntriesChange?: () => void
}

/** Chats per page; the search chevrons step through the pages. */
const PAGE_SIZE = 5

interface SeedEntry {
  title: string
  daysAgo: number
  hour: number
  minute: number
  status?: DelaChatStatus
}

/** Closing Manager prompts an accountant would realistically have asked Dela. */
const SEED_ENTRIES: SeedEntry[] = [
  {
    title: 'Generate financial statements for FY2026 Period 8',
    daysAgo: 0,
    hour: 7,
    minute: 17,
    status: 'Needs Review',
  },
  { title: 'Which closing tasks are still waiting on dependencies?', daysAgo: 0, hour: 6, minute: 42 },
  { title: 'Show the unposted transactions blocking Period 9', daysAgo: 2, hour: 15, minute: 9 },
  { title: 'Summarize posting status by company for subperiod 9', daysAgo: 2, hour: 15, minute: 9 },
  { title: 'Run the closing job for FY2026 Period 8', daysAgo: 3, hour: 9, minute: 15 },
  { title: 'Explain the revenue variance on project 1050-ADMIN', daysAgo: 5, hour: 11, minute: 42 },
  { title: 'Close period for FY2026 Period 8', daysAgo: 15, hour: 8, minute: 5 },
  { title: 'List journal entries pending approval over $50,000', daysAgo: 20, hour: 16, minute: 21 },
  { title: 'Reconcile cash receipts for the August close', daysAgo: 26, hour: 10, minute: 7 },
]

function createSeedEntries(): DelaChatHistoryEntry[] {
  const today = new Date()
  return SEED_ENTRIES.map((seed, index) => {
    const askedOn = new Date(today)
    askedOn.setDate(askedOn.getDate() - seed.daysAgo)
    askedOn.setHours(seed.hour, seed.minute, 0, 0)
    return { id: `chat-${index + 1}`, title: seed.title, askedOn, status: seed.status }
  })
}

/* Kept outside the component so edits and deletes survive closing the panel. */
let sessionEntries: DelaChatHistoryEntry[] | null = null

function readSessionEntries(): DelaChatHistoryEntry[] {
  if (!sessionEntries) sessionEntries = createSeedEntries()
  return sessionEntries
}

/** Keeps the close-period history tag in sync with the message Dela is showing. */
export function setCloseRunHistoryStatus(status: DelaChatStatus) {
  const current = readSessionEntries()
  sessionEntries = current.map((entry) =>
    entry.status != null ? { ...entry, status } : entry
  )
}

/** Background tasks that haven't finished: still running, or waiting on the user's review. */
export function isBackgroundTask(entry: DelaChatHistoryEntry) {
  return entry.status === 'Running' || entry.status === 'Needs Review'
}

export function readRunningTasks(): DelaChatHistoryEntry[] {
  return readSessionEntries()
    .filter(isBackgroundTask)
    .sort((a, b) => b.askedOn.getTime() - a.askedOn.getTime())
}

/** Tasks waiting on the user; the only ones the notification count reports. */
export function readTasksNeedingReview(): DelaChatHistoryEntry[] {
  return readRunningTasks().filter((entry) => entry.status === 'Needs Review')
}

/** Records a close run as running, reusing the chat for the same period if one exists. */
export function startCloseRun(title: string): string {
  const current = readSessionEntries()
  const existing = current.find((entry) => entry.title === title)
  const run: DelaChatHistoryEntry = {
    id: existing?.id ?? `chat-run-${Date.now()}`,
    title,
    askedOn: new Date(),
    status: 'Running',
  }
  sessionEntries = [run, ...current.filter((entry) => entry !== existing)]
  return run.id
}

export function setChatStatus(id: string, status: DelaChatStatus) {
  sessionEntries = readSessionEntries().map((entry) =>
    entry.id === id ? { ...entry, status } : entry
  )
}

export function nextChatStatus(status: DelaChatStatus): DelaChatStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length]
}

function daysBetween(askedOn: Date, today: Date) {
  const start = new Date(askedOn.getFullYear(), askedOn.getMonth(), askedOn.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function groupLabel(askedOn: Date, today: Date) {
  const days = daysBetween(askedOn, today)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days <= 7) return 'Previous 7 days'
  if (days <= 30) return 'Previous 30 days'
  return 'Older'
}

export function formatAskedOn(askedOn: Date) {
  const date = askedOn.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })
  const time = askedOn.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date} • ${time}`
}

export function DelaChatHistory({
  onBack,
  onSelect,
  excludeRunning = false,
  onEntriesChange,
}: DelaChatHistoryProps) {
  const [entries, setEntries] = useState<DelaChatHistoryEntry[]>(readSessionEntries)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const commitEntries = useCallback(
    (next: DelaChatHistoryEntry[]) => {
      sessionEntries = next
      setEntries(next)
      onEntriesChange?.()
    },
    [onEntriesChange]
  )

  const listed = useMemo(
    () => (excludeRunning ? entries.filter((entry) => !isBackgroundTask(entry)) : entries),
    [entries, excludeRunning]
  )

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const found = needle
      ? listed.filter((entry) => entry.title.toLowerCase().includes(needle))
      : listed
    return [...found].sort((a, b) => b.askedOn.getTime() - a.askedOn.getTime())
  }, [listed, query])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = matches.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const groups = useMemo(() => {
    const today = new Date()
    const ordered: { label: string; entries: DelaChatHistoryEntry[] }[] = []
    for (const entry of visible) {
      const label = groupLabel(entry.askedOn, today)
      const group = ordered.find((candidate) => candidate.label === label)
      if (group) group.entries.push(entry)
      else ordered.push({ label, entries: [entry] })
    }
    return ordered
  }, [visible])

  const startRename = (entry: DelaChatHistoryEntry) => {
    setEditingId(entry.id)
    setEditingTitle(entry.title)
  }

  const commitRename = () => {
    const trimmed = editingTitle.trim()
    if (editingId && trimmed) {
      commitEntries(
        entries.map((entry) => (entry.id === editingId ? { ...entry, title: trimmed } : entry))
      )
    }
    setEditingId(null)
  }

  const handleRenameKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitRename()
    if (event.key === 'Escape') setEditingId(null)
  }

  const deleteEntry = (id: string) => {
    commitEntries(entries.filter((entry) => entry.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const cycleStatus = (entry: DelaChatHistoryEntry) => {
    if (!entry.status) return
    const next = nextChatStatus(entry.status)
    commitEntries(
      entries.map((candidate) =>
        candidate.id === entry.id ? { ...candidate, status: next } : candidate
      )
    )
  }

  return (
    <div className="dela-history">
      <div className="dela-history__header">
        <button
          type="button"
          className="dela-history__back"
          aria-label="Back to chat"
          onClick={onBack}
        >
          <Icon name="chevron-left" size="md" />
        </button>
        <h3 className="dela-history__title">Chat History</h3>
      </div>

      <div className="dela-history__search">
        <Input
          type="search"
          icon="magnifying-glass"
          placeholder="Search..."
          aria-label="Search chat history"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(0)
          }}
          trailing={
            <div className="dela-history__pager">
              <button
                type="button"
                className="dela-history__pager-button"
                aria-label="Previous chats"
                disabled={currentPage === 0}
                onClick={() => setPage(Math.max(0, currentPage - 1))}
              >
                <Icon name="chevron-left" size="sm" />
              </button>
              <button
                type="button"
                className="dela-history__pager-button"
                aria-label="More chats"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
              >
                <Icon name="chevron-right" size="sm" />
              </button>
            </div>
          }
        />
      </div>

      <div className="dela-history__scroll">
        {groups.map((group) => (
          <section key={group.label} className="dela-history__group">
            <h4 className="dela-history__group-label">{group.label}</h4>
            {group.entries.map((entry) => (
              <div key={entry.id} className="dela-history__card">
                <div className="dela-history__card-body">
                  {entry.status && (
                    <button
                      type="button"
                      className="dela-history__status"
                      aria-label={`Close run status: ${entry.status}. Tap to change.`}
                      onClick={() => cycleStatus(entry)}
                    >
                      <Badge variant={CLOSE_RUN_BADGE_VARIANT[entry.status]} size="medium">
                        {entry.status}
                      </Badge>
                    </button>
                  )}
                  {editingId === entry.id ? (
                    <input
                      type="text"
                      className="dela-history__rename"
                      aria-label="Chat name"
                      value={editingTitle}
                      autoFocus
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={handleRenameKeys}
                      onBlur={commitRename}
                    />
                  ) : (
                    <button
                      type="button"
                      className="dela-history__card-main"
                      onClick={() => onSelect?.(entry)}
                    >
                      <span className="dela-history__card-title">{entry.title}</span>
                      <span className="dela-history__card-meta">
                        {formatAskedOn(entry.askedOn)}
                      </span>
                    </button>
                  )}
                </div>
                <div className="dela-history__card-actions">
                  <button
                    type="button"
                    className="dela-panel__toolbar-action"
                    aria-label={`Rename ${entry.title}`}
                    onClick={() => startRename(entry)}
                  >
                    <Icon name="pencil" size="sm" />
                  </button>
                  <button
                    type="button"
                    className="dela-panel__toolbar-action"
                    aria-label={`Delete ${entry.title}`}
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </div>
              </div>
            ))}
          </section>
        ))}

        {matches.length === 0 && (
          <p className="dela-history__empty">
            {listed.length === 0
              ? 'Your chat history is empty.'
              : `No chats match “${query.trim()}”.`}
          </p>
        )}
      </div>

      <div className="dela-history__footer">
        <Button
          variant="outline"
          icon="trash"
          className="dela-history__clear"
          disabled={listed.length === 0}
          onClick={() =>
            commitEntries(
              excludeRunning ? entries.filter(isBackgroundTask) : []
            )
          }
        >
          Clear chat history
        </Button>
        <p className="dela-history__note">Chats auto-delete after 90 days</p>
      </div>
    </div>
  )
}
