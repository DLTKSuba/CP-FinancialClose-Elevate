import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { Alert } from './Alert'
import { Button } from './Button'
import { Dropdown } from './Dropdown'
import { NotificationBadge } from './NotificationBadge'
import {
  DelaChatHistory,
  readTasksNeedingReview,
  setChatStatus,
  startCloseRun,
} from './DelaChatHistory'
import type { DelaChatHistoryEntry, DelaChatStatus } from './DelaChatHistory'
import { DelaRunningTasks } from './DelaRunningTasks'
import {
  DelaVendorRecommendations,
  TOP_VENDOR_RECOMMENDATIONS,
  VENDOR_INSIGHT_STEPS,
  poIdFor,
  quoteIdFor,
} from './DelaVendorRecommendations'
import { Link } from './Link'
import './DelaPanelContent.css'

interface DelaMessage {
  id: string
  text: string
}

type ClosePeriodPhase =
  | 'idle'
  | 'checking-readiness'
  | 'readiness-failed'
  | 'form'
  | 'checking-transactions'
  | 'transactions-found'
  | 'starting-close-job'
  | 'close-job-started'
  | 'missing-default-job'
  | 'processing-automatically'
  | 'reviewing-transactions'
  | 'running-closing-job'
  | 'cancelled'
  | 'collecting-vendor-insights'
  | 'vendors-ready'

/** Message Dela shows under the "Running close job" header for each run state.
   Info renders as a Harmony notification; other statuses without an image fall back
   to the Harmony warning icon. */
const CLOSE_RUN_MESSAGE: Record<
  DelaChatStatus,
  { text: string; tone: 'info' | 'success' | 'warning'; image?: string }
> = {
  Running: {
    text: "Task running in background. You'll be notified when complete.",
    tone: 'info',
  },
  Complete: {
    text: 'Close period process successfully',
    tone: 'success',
    image: '/CheckFilled.png',
  },
  'Needs Review': {
    text: 'Close period needs review — some transactions require your attention.',
    tone: 'warning',
  },
}

/** Background RFQ tasks are titled `<prompt> · RFQ sent to <vendor>` so they can be reopened. */
const RFQ_TASK_SEPARATOR = ' · RFQ sent to '

const RFQ_SEND_STEPS = [
  'Attaching requisition lines',
  'Adding need-by dates and delivery terms',
  'Emailing RFQ to vendor',
]

const PO_CREATE_STEPS = [
  'Copying quote lines and pricing',
  'Applying requisition charging',
  'Saving purchase order',
]

type RfqStage = 'none' | 'sending' | 'awaiting-quote' | 'quote-received'

type QuoteOutcome = 'creating-po' | 'po-created' | 'cancelled'

const RFQ_STAGE_FOR_STATUS: Record<DelaChatStatus, RfqStage> = {
  Running: 'awaiting-quote',
  'Needs Review': 'quote-received',
  Complete: 'quote-received',
}

function CloseRunStatusReply({
  status,
  onOpenRunningTasks,
}: {
  status: DelaChatStatus
  onOpenRunningTasks: () => void
}) {
  const message = CLOSE_RUN_MESSAGE[status]
  if (message.tone === 'info') {
    return (
      <Alert variant="info" style="enhanced">
        {message.text} Check{' '}
        <button
          type="button"
          className="dela-panel__running-tasks-link"
          onClick={onOpenRunningTasks}
        >
          <Icon name="arrow-path" size="xs" />
          Running Tasks
        </button>{' '}
        for updates.
      </Alert>
    )
  }
  return (
    <p className={`dela-panel__response dela-panel__response--${message.tone}`} role="status">
      {message.image ? (
        <img src={message.image} alt="" className="dela-panel__response-icon" />
      ) : (
        <Icon
          name="exclamation-triangle"
          size="sm"
          className="dela-panel__response-icon dela-panel__warning-icon"
        />
      )}
      {message.text}
    </p>
  )
}

interface TransactionBreakdown {
  label: string
  count: number
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Period N maps to calendar month N in this prototype's fiscal calendar. */
const CURRENT_FISCAL_YEAR = 'FY2026'
const CURRENT_PERIOD = '9'

const FISCAL_YEAR_OPTIONS = [
  { value: 'FY2025', label: 'FY2025' },
  { value: 'FY2026', label: 'FY2026' },
  { value: 'FY2027', label: 'FY2027' },
]

const PERIOD_OPTIONS = MONTHS.map((month, index) => {
  const value = String(index + 1)
  const isCurrent = value === CURRENT_PERIOD
  return {
    value,
    label: `Period ${value} · ${month}${isCurrent ? ' (current)' : ''}`,
  }
})

const CLOSE_JOB_OPTIONS = [
  { value: 'standard-month-end', label: 'Standard Month-End Close' },
  { value: 'accelerated-month-end', label: 'Accelerated Month-End Close' },
  { value: 'quarter-end', label: 'Quarter-End Close' },
]

const TRANSACTION_BREAKDOWN: TransactionBreakdown[] = [
  { label: 'Vouchers', count: 4 },
  { label: 'Journal Entries', count: 6 },
]

const UNPOSTED_TRANSACTION_TOTAL = TRANSACTION_BREAKDOWN.reduce(
  (total, item) => total + item.count,
  0
)

/** Stages Dela works through once the user hands posting over to it. */
const POSTING_STEPS = ['Approval validation', 'Auto posting', 'Revalidation']

const POSTING_SUMMARY: Array<{ label: string; value: string }> = [
  { label: 'Posted', value: String(UNPOSTED_TRANSACTION_TOTAL) },
  { label: 'Remaining', value: '0' },
  { label: 'Approved by', value: 'Auto-approved policy' },
  { label: 'Posted by', value: 'Dela, guided agent' },
]

/** Monthly close job Dela runs after posting finishes. */
const CLOSING_JOB_STEPS = [
  'Calculate burden',
  'Update reporting tables',
  'Generate reports',
  'Publish outputs',
  'Job complete',
]

const TRANSACTION_CARD = (
  <dl className="dela-panel__transaction-card" id="dela-transaction-detail">
    {TRANSACTION_BREAKDOWN.map((item) => (
      <div key={item.label} className="dela-panel__transaction-row">
        <dt>{item.label}</dt>
        <dd>{item.count}</dd>
      </div>
    ))}
    <div className="dela-panel__transaction-row dela-panel__transaction-row--total">
      <dt>Total</dt>
      <dd>{UNPOSTED_TRANSACTION_TOTAL}</dd>
    </div>
  </dl>
)

function WorkflowChecklist({ steps, doneCount }: { steps: string[]; doneCount: number }) {
  return (
    <dl className="dela-panel__posting-card">
      {steps.map((label, index) => {
        const done = index < doneCount
        const running = index === doneCount
        return (
          <div key={label} className="dela-panel__posting-row">
            <dt>
              <Icon
                name={done ? 'check' : running ? 'arrow-path' : 'clock'}
                size="sm"
                className={
                  done
                    ? 'dela-panel__check-icon'
                    : running
                      ? 'dela-panel__posting-spinner'
                      : 'dela-panel__posting-waiting-icon'
                }
              />
              {label}
            </dt>
            <dd className={done ? 'dela-panel__posting-status--done' : undefined}>
              {done ? 'Completed' : running ? 'In progress' : 'Waiting'}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

const calendarYear = (fiscalYear: string) => Number(fiscalYear.replace('FY', ''))

export interface DelaPanelContentProps {
  /** Empty-state prompt shown before the first message is sent. */
  greeting?: string
  placeholder?: string
  disclaimer?: string
  /** Dropped into the empty composer on first click so the flow can be demoed in two clicks. */
  suggestedPrompt?: string
  /** Prototype readiness flag for the tenant's Close through Dela configuration. */
  closeThroughDelaEnabled?: boolean
  /** When true, Continue on the period form asks the user to pick a close job. */
  missingDefaultJob?: boolean
  /** Sent as the user's message from outside the panel (e.g. Create PO); a new `id` starts a new conversation. */
  externalPrompt?: { id: number; text: string } | null
  onExternalPromptConsumed?: () => void
}

export function DelaPanelContent({
  greeting = 'What’s on the agenda today?',
  placeholder = 'Ask Dela Anything...',
  disclaimer = 'Disclaimer',
  suggestedPrompt = 'Close period',
  closeThroughDelaEnabled = true,
  missingDefaultJob = false,
  externalPrompt = null,
  onExternalPromptConsumed,
}: DelaPanelContentProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [runningTasksOpen, setRunningTasksOpen] = useState(false)
  /** Bumped when the session task list changes so the running count re-reads it. */
  const [, setTasksVersion] = useState(0)
  const [messages, setMessages] = useState<DelaMessage[]>([])
  const [startedOn, setStartedOn] = useState('')
  const [phase, setPhase] = useState<ClosePeriodPhase>('idle')
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR)
  const [period, setPeriod] = useState(CURRENT_PERIOD)
  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const [postedSteps, setPostedSteps] = useState(0)
  const [postingOpen, setPostingOpen] = useState(false)
  const [closingJobSteps, setClosingJobSteps] = useState(0)
  const [closingJobOpen, setClosingJobOpen] = useState(false)
  /** Drives the close-job message; history chats reopen with their tag's state. */
  const [closeRunStatus, setCloseRunStatus] = useState<DelaChatStatus>('Running')
  const [selectedCloseJob, setSelectedCloseJob] = useState('')
  const [vendorSteps, setVendorSteps] = useState(0)
  const [vendorStepsOpen, setVendorStepsOpen] = useState(false)
  const [rfqVendorName, setRfqVendorName] = useState<string | null>(null)
  const [rfqStage, setRfqStage] = useState<RfqStage>('none')
  const [rfqSendSteps, setRfqSendSteps] = useState(0)
  const [rfqStepsOpen, setRfqStepsOpen] = useState(false)
  const [rfqTaskId, setRfqTaskId] = useState<string | null>(null)
  const [quoteOutcome, setQuoteOutcome] = useState<QuoteOutcome | null>(null)
  const [poCreateSteps, setPoCreateSteps] = useState(0)
  const quoteTurnRef = useRef<HTMLElement>(null)
  const poResultRef = useRef<HTMLElement>(null)

  const hasConversation = messages.length > 0
  const canSend = draft.trim() !== ''
  /** The period is settled once Continue starts the transaction check. */
  const periodConfirmed =
    phase === 'checking-transactions' ||
    phase === 'transactions-found' ||
    phase === 'processing-automatically' ||
    phase === 'reviewing-transactions' ||
    phase === 'running-closing-job'
  /** Once the user picks a handling option the finding collapses to a done step. */
  const transactionsHandled =
    phase === 'processing-automatically' ||
    phase === 'reviewing-transactions' ||
    phase === 'running-closing-job'
  /** Continue settles the period, so the pickers stay on screen read-only. */
  const periodLocked = phase !== 'form'
  const postingComplete = postedSteps >= POSTING_STEPS.length
  const closingJobComplete = closingJobSteps >= CLOSING_JOB_STEPS.length
  const vendorInsightsComplete = vendorSteps >= VENDOR_INSIGHT_STEPS.length
  const isThinking =
    phase === 'checking-readiness' ||
    phase === 'collecting-vendor-insights' ||
    (phase === 'vendors-ready' && (rfqStage === 'sending' || quoteOutcome === 'creating-po'))
  const poPrompt = messages[0]?.text ?? ''
  const requisitionId = poPrompt.match(/^Create PO for (\S+)/)?.[1]
  const rfqVendorRank =
    TOP_VENDOR_RECOMMENDATIONS.find((vendor) => vendor.name === rfqVendorName)?.rank ?? 1
  const quoteId = quoteIdFor(requisitionId, rfqVendorRank)
  const periodConfirmation = `Fiscal year ${calendarYear(fiscalYear)}, period ${period} (${
    MONTHS[Number(period) - 1]
  }) is selected for close.`
  const reviewTaskCount = readTasksNeedingReview().length
  const refreshTasks = useCallback(() => setTasksVersion((version) => version + 1), [])

  const startCloseJob = () => {
    setCloseRunStatus('Running')
    startCloseRun(`Close period for ${fiscalYear} Period ${period}`)
    refreshTasks()
    setPhase('starting-close-job')
  }

  const openRunningTasks = () => {
    setHistoryOpen(false)
    setRunningTasksOpen(true)
  }

  const sendRfq = (vendorName: string) => {
    setRfqVendorName(vendorName)
    setRfqSendSteps(0)
    setRfqStepsOpen(false)
    setQuoteOutcome(null)
    setRfqStage('sending')
    setRfqTaskId(startCloseRun(`${poPrompt || 'Create PO'}${RFQ_TASK_SEPARATOR}${vendorName}`))
    refreshTasks()
  }

  const completeRfqTask = useCallback(() => {
    if (rfqTaskId != null) setChatStatus(rfqTaskId, 'Complete')
    refreshTasks()
  }, [rfqTaskId, refreshTasks])

  const createPoFromQuote = () => {
    setPoCreateSteps(0)
    setQuoteOutcome('creating-po')
  }

  const cancelQuote = () => {
    setQuoteOutcome('cancelled')
    completeRfqTask()
  }

  /** History and Running Tasks both reopen a close run's finished conversation. */
  const reopenCloseRun = (entry: DelaChatHistoryEntry) => {
    if (!entry.status) return
    setStartedOn(entry.askedOn.toLocaleDateString())
    const [rfqPrompt, rfqVendor] = entry.title.split(RFQ_TASK_SEPARATOR)
    if (rfqVendor != null) {
      setMessages([{ id: `dela-message-${entry.id}`, text: rfqPrompt }])
      setVendorSteps(VENDOR_INSIGHT_STEPS.length)
      setVendorStepsOpen(false)
      setRfqVendorName(rfqVendor)
      setRfqSendSteps(RFQ_SEND_STEPS.length)
      setRfqStepsOpen(false)
      setRfqTaskId(entry.id)
      setQuoteOutcome(entry.status === 'Complete' ? 'po-created' : null)
      setPoCreateSteps(PO_CREATE_STEPS.length)
      setRfqStage(RFQ_STAGE_FOR_STATUS[entry.status])
      setPhase('vendors-ready')
      return
    }
    setMessages([{ id: `dela-message-${entry.id}`, text: entry.title }])
    setCloseRunStatus(entry.status)
    setPhase('close-job-started')
  }

  /** Each scan just flashes long enough to read, so the demo keeps moving. */
  useEffect(() => {
    if (phase !== 'checking-readiness') return
    const timer = window.setTimeout(
      () => setPhase(closeThroughDelaEnabled ? 'form' : 'readiness-failed'),
      600
    )
    return () => window.clearTimeout(timer)
  }, [closeThroughDelaEnabled, phase])

  useEffect(() => {
    if (phase !== 'checking-transactions') return
    const timer = window.setTimeout(() => setPhase('transactions-found'), 600)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'starting-close-job') return
    const timer = window.setTimeout(
      () =>
        setPhase(
          missingDefaultJob && !selectedCloseJob ? 'missing-default-job' : 'close-job-started'
        ),
      600
    )
    return () => window.clearTimeout(timer)
  }, [missingDefaultJob, phase, selectedCloseJob])

  useEffect(() => {
    if (phase !== 'processing-automatically' || postingComplete) return
    const timer = window.setTimeout(() => setPostedSteps((done) => done + 1), 600)
    return () => window.clearTimeout(timer)
  }, [phase, postedSteps, postingComplete])

  useEffect(() => {
    if (phase !== 'processing-automatically' || !postingComplete) return
    setPhase('running-closing-job')
  }, [phase, postingComplete])

  useEffect(() => {
    if (phase !== 'running-closing-job' || closingJobComplete) return
    const timer = window.setTimeout(() => setClosingJobSteps((done) => done + 1), 600)
    return () => window.clearTimeout(timer)
  }, [phase, closingJobSteps, closingJobComplete])

  useEffect(() => {
    if (phase !== 'collecting-vendor-insights') return
    if (vendorInsightsComplete) {
      setPhase('vendors-ready')
      return
    }
    const timer = window.setTimeout(() => setVendorSteps((done) => done + 1), 900)
    return () => window.clearTimeout(timer)
  }, [phase, vendorSteps, vendorInsightsComplete])

  useEffect(() => {
    if (rfqStage !== 'sending') return
    if (rfqSendSteps >= RFQ_SEND_STEPS.length) {
      setRfqStage('awaiting-quote')
      return
    }
    const timer = window.setTimeout(() => setRfqSendSteps((done) => done + 1), 700)
    return () => window.clearTimeout(timer)
  }, [rfqStage, rfqSendSteps])

  useEffect(() => {
    if (quoteOutcome !== 'creating-po') return
    if (poCreateSteps >= PO_CREATE_STEPS.length) {
      setQuoteOutcome('po-created')
      completeRfqTask()
      return
    }
    const timer = window.setTimeout(() => setPoCreateSteps((done) => done + 1), 650)
    return () => window.clearTimeout(timer)
  }, [quoteOutcome, poCreateSteps, completeRfqTask])

  useEffect(() => {
    if (rfqStage !== 'quote-received' || runningTasksOpen || historyOpen) return
    const latestTurn = quoteOutcome === 'po-created' ? poResultRef.current : quoteTurnRef.current
    latestTurn?.scrollIntoView({ block: 'end' })
  }, [rfqStage, quoteOutcome, runningTasksOpen, historyOpen])

  const externalPromptId = externalPrompt?.id
  useEffect(() => {
    if (externalPrompt == null) return
    setHistoryOpen(false)
    setRunningTasksOpen(false)
    setDraft('')
    setMessages([{ id: `dela-message-${externalPrompt.id}`, text: externalPrompt.text }])
    setStartedOn(new Date().toLocaleDateString())
    setVendorSteps(0)
    setVendorStepsOpen(false)
    setRfqVendorName(null)
    setRfqStage('none')
    setRfqSendSteps(0)
    setRfqTaskId(null)
    setQuoteOutcome(null)
    setPhase('collecting-vendor-insights')
    onExternalPromptConsumed?.()
    // Only a new prompt id restarts the flow.
  }, [externalPromptId])

  const sendDraft = useCallback(() => {
    const text = draft.trim()
    if (text === '') return
    setMessages((prev) => {
      if (prev.length === 0) {
        setStartedOn(new Date().toLocaleDateString())
        setPhase('checking-readiness')
        setFiscalYear(CURRENT_FISCAL_YEAR)
        setPeriod(CURRENT_PERIOD)
        setTransactionsOpen(false)
        setPostedSteps(0)
        setPostingOpen(false)
        setClosingJobSteps(0)
        setClosingJobOpen(false)
      }
      return [...prev, { id: `dela-message-${Date.now()}`, text }]
    })
    setDraft('')
  }, [draft])

  const prefillDraft = useCallback(() => {
    if (draft !== '' || suggestedPrompt === '') return
    setDraft(suggestedPrompt)
  }, [draft, suggestedPrompt])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      sendDraft()
    },
    [sendDraft]
  )

  const editTitle = useCallback(() => {
    const first = messages[0]
    if (!first) return
    setDraft(first.text)
    inputRef.current?.focus()
  }, [messages])

  const clearConversation = useCallback(() => {
    setHistoryOpen(false)
    setRunningTasksOpen(false)
    setDraft('')
    setMessages([])
    setStartedOn('')
    setPhase('idle')
    setCloseRunStatus('Running')
    setFiscalYear(CURRENT_FISCAL_YEAR)
    setPeriod(CURRENT_PERIOD)
    setTransactionsOpen(false)
    setPostedSteps(0)
    setPostingOpen(false)
    setClosingJobSteps(0)
    setClosingJobOpen(false)
    setSelectedCloseJob('')
    setVendorSteps(0)
    setVendorStepsOpen(false)
    setRfqVendorName(null)
    setRfqStage('none')
    setRfqSendSteps(0)
    setRfqTaskId(null)
    setQuoteOutcome(null)
  }, [])

  return (
    <div className="dela-panel__body">
      <div className="dela-panel__quick-actions">
        <button
          type="button"
          className="dela-panel__toolbar-action"
          aria-label="New conversation"
          title="New conversation"
          onClick={clearConversation}
        >
          <Icon name="plus" size="md" />
        </button>
        <button
          type="button"
          className="dela-panel__toolbar-action"
          aria-label="Chat history"
          title="Chat history"
          aria-pressed={historyOpen}
          disabled={missingDefaultJob}
          onClick={() => {
            if (missingDefaultJob) return
            setRunningTasksOpen(false)
            setHistoryOpen((open) => !open)
          }}
        >
          <Icon name="clock" size="md" />
        </button>
        <button
          type="button"
          className="dela-panel__toolbar-action dela-panel__running-tasks-action"
          aria-label={`Running tasks (${reviewTaskCount} need review)`}
          title="Running tasks"
          aria-pressed={runningTasksOpen}
          onClick={() => {
            setHistoryOpen(false)
            setRunningTasksOpen((open) => !open)
          }}
        >
          <Icon name="arrow-path" size="md" />
          {reviewTaskCount > 0 && (
            <NotificationBadge
              type="number"
              size="sm"
              value={reviewTaskCount}
              className="dela-panel__running-tasks-count"
            />
          )}
        </button>
        <button
          type="button"
          className="dela-panel__toolbar-action"
          aria-label="Help"
          title="Help"
        >
          <Icon name="question-mark-circle" size="md" />
        </button>
        <button
          type="button"
          className="dela-panel__toolbar-action"
          aria-label="Dela settings"
          title="Dela settings"
        >
          <Icon name="cog-6-tooth" size="md" />
        </button>
      </div>

      {runningTasksOpen ? (
        <DelaRunningTasks
          onBack={() => setRunningTasksOpen(false)}
          onTasksChange={refreshTasks}
          onSelect={(entry) => {
            setRunningTasksOpen(false)
            reopenCloseRun(entry)
          }}
        />
      ) : historyOpen && !missingDefaultJob ? (
        <DelaChatHistory
          excludeRunning
          onEntriesChange={refreshTasks}
          onBack={() => setHistoryOpen(false)}
          onSelect={(entry) => {
            setHistoryOpen(false)
            /* Close runs reopen their finished conversation; other chats just prefill. */
            if (entry.status) {
              reopenCloseRun(entry)
              return
            }
            setDraft(entry.title)
            inputRef.current?.focus()
          }}
        />
      ) : (
        <>
        {hasConversation && (
          <div className="dela-panel__conversation-header">
            <h3 className="dela-panel__conversation-title">{messages[0].text}</h3>
            <div className="dela-panel__conversation-actions">
              <button
                type="button"
                className="dela-panel__toolbar-action"
                aria-label="Edit prompt"
                onClick={editTitle}
              >
                <Icon name="pencil" size="sm" />
              </button>
              <button
                type="button"
                className="dela-panel__toolbar-action"
                aria-label="Delete conversation"
                onClick={clearConversation}
              >
                <Icon name="trash" size="sm" />
              </button>
            </div>
          </div>
        )}

        <div className="dela-panel__scroll">
          {hasConversation ? (
            <>
              <div className="dela-panel__date-divider">{startedOn}</div>
              {messages.map((message) => (
                <div key={message.id} className="dela-panel__message-group">
                  <div className="dela-panel__message-row dela-panel__message-row--user">
                    <div className="dela-panel__bubble dela-panel__bubble--user">{message.text}</div>
                  </div>
                  <div className="dela-panel__message-actions">
                    <button
                      type="button"
                      className="dela-panel__toolbar-action"
                      aria-label="Copy message"
                      onClick={() => void navigator.clipboard?.writeText(message.text)}
                    >
                      <Icon name="square-2-stack" size="sm" />
                    </button>
                  </div>
                </div>
              ))}
              {phase !== 'idle' && (
                <div className="dela-panel__message-row">
                  <button
                    type="button"
                    className="dela-panel__mark-button"
                    aria-label="Start a new conversation"
                    title="Start a new conversation"
                    onClick={clearConversation}
                  >
                    {/* Sparkles while Dela works; the colour mark lands with the result */}
                    {isThinking ? (
                      <img
                        src="/Stars.svg"
                        alt=""
                        className="dela-panel__message-icon dela-panel__message-icon--thinking"
                      />
                    ) : (
                      <img
                        src="/RS_Dela_Active.svg"
                        alt=""
                        className="dela-panel__message-icon dela-panel__message-icon--dela"
                      />
                    )}
                  </button>
                  {/* One Dela turn: readiness result, period picker and actions share a single gutter */}
                  <div className="dela-panel__turn">
                    {phase === 'checking-readiness' && (
                      <p className="dela-panel__readiness" role="status" aria-live="polite">
                        Checking readiness for Close through Dela ...
                      </p>
                    )}

                    {phase === 'readiness-failed' && (
                      <div className="dela-panel__response-stack" role="status" aria-live="polite">
                        <p className="dela-panel__response">
                          This request cannot be completed because Financial Close execution is not
                          currently enabled through Dela.
                        </p>
                        <p className="dela-panel__response">
                          To use this capability, an administrator must configure and enable the
                          Financial Close service.
                        </p>
                      </div>
                    )}

                    {(phase === 'form' ||
                      phase === 'checking-transactions' ||
                      phase === 'transactions-found' ||
                      phase === 'starting-close-job' ||
                      phase === 'close-job-started' ||
                      phase === 'missing-default-job') && (
                      <>
                        <div className="dela-panel__field-group">
                          <span className="dela-panel__field-group-label">
                            <img src="/RS_Dela_Active.svg" alt="" />
                            Confirm fiscal year and period
                          </span>
                          <div className="dela-panel__field-row">
                            <Dropdown
                              id="dela-close-fiscal-year"
                              name="fiscalYear"
                              options={FISCAL_YEAR_OPTIONS}
                              value={fiscalYear}
                              onChange={setFiscalYear}
                              disabled={periodLocked}
                            />
                            <Dropdown
                              id="dela-close-period"
                              name="period"
                              options={PERIOD_OPTIONS}
                              value={period}
                              onChange={setPeriod}
                              disabled={periodLocked}
                            />
                          </div>
                        </div>

                        {!periodLocked && (
                          <div className="dela-panel__turn-actions">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => setPhase('checking-transactions')}
                            >
                              Continue
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPhase('cancelled')}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {periodConfirmed &&
                      phase !== 'checking-transactions' &&
                      phase !== 'transactions-found' && (
                        <p className="dela-panel__period-confirm">{periodConfirmation}</p>
                      )}

                    {phase === 'checking-transactions' && (
                      <p
                        className="dela-panel__readiness dela-panel__transaction-thinking"
                        role="status"
                        aria-live="polite"
                      >
                        <img src="/Stars.svg" alt="" />
                        Checking for unposted transactions ...
                      </p>
                    )}

                    {(phase === 'transactions-found' ||
                      phase === 'starting-close-job' ||
                      phase === 'close-job-started' ||
                      phase === 'missing-default-job') && (
                      <section
                        className="dela-panel__transaction-result"
                        aria-labelledby="dela-unposted-transactions-title"
                      >
                        <div className="dela-panel__transaction-heading dela-panel__transaction-heading--prompt">
                          <img
                            src="/RS_Dela_Active.svg"
                            alt=""
                            className="dela-panel__transaction-dela-icon"
                          />
                          <h4 id="dela-unposted-transactions-title">
                            You have {UNPOSTED_TRANSACTION_TOTAL} unposted transactions
                          </h4>
                        </div>
                        {TRANSACTION_CARD}
                        {phase === 'transactions-found' && (
                          <div className="dela-panel__transaction-actions">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                if (missingDefaultJob) {
                                  setSelectedCloseJob('')
                                  setPhase('starting-close-job')
                                  return
                                }
                                startCloseJob()
                              }}
                            >
                              Process automatically
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPhase('reviewing-transactions')}
                            >
                              Review manually
                            </Button>
                          </div>
                        )}
                      </section>
                    )}

                    {phase === 'starting-close-job' && (
                      <p
                        className="dela-panel__readiness dela-panel__transaction-thinking"
                        role="status"
                        aria-live="polite"
                      >
                        <img src="/Stars.svg" alt="" />
                        Starting close job ...
                      </p>
                    )}

                    {(phase === 'close-job-started' || phase === 'missing-default-job') && (
                      <section className="dela-panel__close-job" aria-live="polite">
                        <div className="dela-panel__transaction-heading">
                          <img
                            src="/RS_Dela_Active.svg"
                            alt=""
                            className="dela-panel__transaction-dela-icon"
                          />
                          <h4>Running close job</h4>
                        </div>
                        {phase === 'missing-default-job' ? (
                          <>
                            <p
                              className="dela-panel__response dela-panel__response--info"
                              role="status"
                            >
                              <img
                                src="/InfoFilled.png"
                                alt=""
                                className="dela-panel__response-icon"
                              />
                              No default close job is set up for this period. Choose one to continue.
                            </p>
                            <Dropdown
                              id="dela-close-job"
                              name="closeJob"
                              className="dela-panel__close-job-select"
                              options={CLOSE_JOB_OPTIONS}
                              value={selectedCloseJob}
                              placeholder="Select a close job"
                              onChange={setSelectedCloseJob}
                            />
                            <div className="dela-panel__turn-actions">
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                disabled={!selectedCloseJob}
                                onClick={startCloseJob}
                              >
                                Continue
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPhase('cancelled')}
                              >
                                Cancel
                              </Button>
                            </div>
                          </>
                        ) : (
                          <CloseRunStatusReply
                            status={closeRunStatus}
                            onOpenRunningTasks={openRunningTasks}
                          />
                        )}
                      </section>
                    )}

                    {transactionsHandled && (
                      <section className="dela-panel__step">
                        <div className="dela-panel__step-row">
                          <img src="/RS_Dela_Active.svg" alt="" />
                          <button
                            type="button"
                            className="dela-panel__readiness-summary"
                            aria-expanded={transactionsOpen}
                            aria-controls="dela-transaction-detail"
                            onClick={() => setTransactionsOpen((open) => !open)}
                          >
                            <Icon name="check" size="sm" className="dela-panel__check-icon" />
                            <span className="dela-panel__readiness-summary-text">
                              {UNPOSTED_TRANSACTION_TOTAL} unposted transactions found ·{' '}
                              {phase === 'reviewing-transactions'
                                ? 'Review manually'
                                : 'Proceed automatically'}
                            </span>
                            <Icon
                              name={transactionsOpen ? 'chevron-up' : 'chevron-down'}
                              size="sm"
                            />
                          </button>
                        </div>
                        {transactionsOpen && TRANSACTION_CARD}
                      </section>
                    )}

                    {phase === 'processing-automatically' && !postingComplete && (
                      <section className="dela-panel__posting">
                        <p
                          className="dela-panel__readiness dela-panel__posting-heading"
                          role="status"
                          aria-live="polite"
                        >
                          <img src="/Stars.svg" alt="" className="dela-panel__posting-sparkle" />
                          Posting transactions ...
                        </p>

                        <WorkflowChecklist steps={POSTING_STEPS} doneCount={postedSteps} />
                      </section>
                    )}

                    {postingComplete &&
                      (phase === 'processing-automatically' ||
                        phase === 'running-closing-job') && (
                      <section className="dela-panel__step">
                        <div className="dela-panel__step-row">
                          <img src="/RS_Dela_Active.svg" alt="" />
                          <button
                            type="button"
                            className="dela-panel__readiness-summary"
                            aria-expanded={postingOpen}
                            aria-controls="dela-posting-detail"
                            onClick={() => setPostingOpen((open) => !open)}
                          >
                            <Icon name="check" size="sm" className="dela-panel__check-icon" />
                            <span className="dela-panel__readiness-summary-text">
                              Posting complete · {UNPOSTED_TRANSACTION_TOTAL} posted, 0 remaining
                            </span>
                            <Icon
                              name={postingOpen ? 'chevron-up' : 'chevron-down'}
                              size="sm"
                            />
                          </button>
                        </div>
                        {postingOpen && (
                          <dl
                            className="dela-panel__posting-summary-card"
                            id="dela-posting-detail"
                          >
                            {POSTING_SUMMARY.map((item) => (
                              <div key={item.label} className="dela-panel__posting-summary-row">
                                <dt>{item.label}</dt>
                                <dd>{item.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </section>
                    )}

                    {phase === 'running-closing-job' && !closingJobComplete && (
                      <section className="dela-panel__posting">
                        <p
                          className="dela-panel__readiness dela-panel__posting-heading"
                          role="status"
                          aria-live="polite"
                        >
                          <img src="/Stars.svg" alt="" className="dela-panel__posting-sparkle" />
                          Running closing job ...
                        </p>
                        <WorkflowChecklist
                          steps={CLOSING_JOB_STEPS}
                          doneCount={closingJobSteps}
                        />
                      </section>
                    )}

                    {phase === 'running-closing-job' && closingJobComplete && (
                      <section className="dela-panel__step">
                        <div className="dela-panel__step-row">
                          <img src="/RS_Dela_Active.svg" alt="" />
                          <button
                            type="button"
                            className="dela-panel__readiness-summary"
                            aria-expanded={closingJobOpen}
                            aria-controls="dela-closing-job-detail"
                            onClick={() => setClosingJobOpen((open) => !open)}
                          >
                            <Icon name="check" size="sm" className="dela-panel__check-icon" />
                            <span className="dela-panel__readiness-summary-text">
                              Closing job complete
                            </span>
                            <Icon
                              name={closingJobOpen ? 'chevron-up' : 'chevron-down'}
                              size="sm"
                            />
                          </button>
                        </div>
                        {closingJobOpen && (
                          <div id="dela-closing-job-detail">
                            <WorkflowChecklist
                              steps={CLOSING_JOB_STEPS}
                              doneCount={CLOSING_JOB_STEPS.length}
                            />
                          </div>
                        )}
                      </section>
                    )}

                    {phase === 'collecting-vendor-insights' && (
                      <section className="dela-panel__posting">
                        <p
                          className="dela-panel__readiness dela-panel__posting-heading"
                          role="status"
                          aria-live="polite"
                        >
                          <img src="/Stars.svg" alt="" className="dela-panel__posting-sparkle" />
                          Collecting vendor insights ...
                        </p>
                        <p className="dela-panel__response">
                          Vendor insights are needed to create this PO. I&apos;ll share the top
                          vendors shortly.
                        </p>
                        <WorkflowChecklist steps={VENDOR_INSIGHT_STEPS} doneCount={vendorSteps} />
                      </section>
                    )}

                    {phase === 'vendors-ready' && (
                      <>
                        <section className="dela-panel__step">
                          <div className="dela-panel__step-row">
                            <img src="/RS_Dela_Active.svg" alt="" />
                            <button
                              type="button"
                              className="dela-panel__readiness-summary"
                              aria-expanded={vendorStepsOpen}
                              aria-controls="dela-vendor-insight-detail"
                              onClick={() => setVendorStepsOpen((open) => !open)}
                            >
                              <Icon name="check" size="sm" className="dela-panel__check-icon" />
                              <span className="dela-panel__readiness-summary-text">
                                Vendor insights collected · 3 vendors ranked
                              </span>
                              <Icon
                                name={vendorStepsOpen ? 'chevron-up' : 'chevron-down'}
                                size="sm"
                              />
                            </button>
                          </div>
                          {vendorStepsOpen && (
                            <div id="dela-vendor-insight-detail">
                              <WorkflowChecklist
                                steps={VENDOR_INSIGHT_STEPS}
                                doneCount={VENDOR_INSIGHT_STEPS.length}
                              />
                            </div>
                          )}
                        </section>
                        <DelaVendorRecommendations
                          requisitionId={requisitionId}
                          rfqSentTo={rfqVendorName}
                          onSendRfq={(vendor) => sendRfq(vendor.name)}
                        />
                        {rfqStage === 'sending' && (
                          <section className="dela-panel__posting">
                            <p
                              className="dela-panel__readiness dela-panel__posting-heading"
                              role="status"
                              aria-live="polite"
                            >
                              <img src="/Stars.svg" alt="" className="dela-panel__posting-sparkle" />
                              Sending RFQ to {rfqVendorName} ...
                            </p>
                            <WorkflowChecklist steps={RFQ_SEND_STEPS} doneCount={rfqSendSteps} />
                          </section>
                        )}
                        {(rfqStage === 'awaiting-quote' || rfqStage === 'quote-received') && (
                          <section className="dela-panel__step">
                            <div className="dela-panel__step-row">
                              <img src="/RS_Dela_Active.svg" alt="" />
                              <button
                                type="button"
                                className="dela-panel__readiness-summary"
                                aria-expanded={rfqStepsOpen}
                                aria-controls="dela-rfq-send-detail"
                                onClick={() => setRfqStepsOpen((open) => !open)}
                              >
                                <Icon name="check" size="sm" className="dela-panel__check-icon" />
                                <span className="dela-panel__readiness-summary-text">
                                  RFQ sent, waiting for a quote
                                </span>
                                <Icon
                                  name={rfqStepsOpen ? 'chevron-up' : 'chevron-down'}
                                  size="sm"
                                />
                              </button>
                            </div>
                            {rfqStepsOpen && (
                              <div id="dela-rfq-send-detail">
                                <WorkflowChecklist
                                  steps={RFQ_SEND_STEPS}
                                  doneCount={RFQ_SEND_STEPS.length}
                                />
                              </div>
                            )}
                            <Alert variant="info" style="enhanced">
                              The RFQ to {rfqVendorName} is in progress. You&apos;ll be notified
                              when their quote is received. This task is running in the
                              background. Check{' '}
                              <button
                                type="button"
                                className="dela-panel__running-tasks-link"
                                onClick={openRunningTasks}
                              >
                                <Icon name="arrow-path" size="xs" />
                                Running Tasks
                              </button>{' '}
                              for updates.
                            </Alert>
                          </section>
                        )}
                        {rfqStage === 'quote-received' && (
                          <section className="dela-panel__step" ref={quoteTurnRef}>
                            <div className="dela-panel__step-row">
                              <img src="/RS_Dela_Active.svg" alt="" />
                              <p className="dela-panel__step-message" role="status">
                                {rfqVendorName} responded. Quote{' '}
                                <Link href="#" onClick={(event) => event.preventDefault()}>
                                  {quoteId}
                                </Link>{' '}
                                was generated.
                              </p>
                            </div>
                            {quoteOutcome == null && (
                              <div className="dela-panel__turn-actions">
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={createPoFromQuote}
                                >
                                  Create PO
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={cancelQuote}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                            {quoteOutcome === 'cancelled' && (
                              <p className="dela-panel__response" role="status">
                                PO creation cancelled.
                              </p>
                            )}
                          </section>
                        )}
                        {quoteOutcome === 'creating-po' && (
                          <section className="dela-panel__posting">
                            <p
                              className="dela-panel__readiness dela-panel__posting-heading"
                              role="status"
                              aria-live="polite"
                            >
                              <img src="/Stars.svg" alt="" className="dela-panel__posting-sparkle" />
                              Creating PO from quote {quoteId} ...
                            </p>
                            <WorkflowChecklist steps={PO_CREATE_STEPS} doneCount={poCreateSteps} />
                          </section>
                        )}
                        {quoteOutcome === 'po-created' && (
                          <section className="dela-panel__step" ref={poResultRef}>
                            <div className="dela-panel__step-row">
                              <img src="/RS_Dela_Active.svg" alt="" />
                              <p className="dela-panel__step-message" role="status">
                                {requisitionId != null
                                  ? `PO for Req ${requisitionId} is successfully created.`
                                  : 'PO is successfully created.'}{' '}
                                <Link
                                  href="#"
                                  className="dela-panel__record-link"
                                  onClick={(event) => event.preventDefault()}
                                >
                                  View PO {poIdFor(requisitionId)}
                                </Link>
                              </p>
                            </div>
                          </section>
                        )}
                      </>
                    )}

                    {phase === 'reviewing-transactions' && (
                      <p className="dela-panel__response">
                        Opening the {UNPOSTED_TRANSACTION_TOTAL} unposted transactions for manual
                        review.
                      </p>
                    )}
                    {phase === 'cancelled' && (
                      <p className="dela-panel__response">Period close has been cancelled.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="dela-panel__greeting">{greeting}</p>
          )}
        </div>

        <div className="dela-panel__input-row">
          <div className="dela-panel__input-box">
            <input
              ref={inputRef}
              type="text"
              className="dela-panel__input"
              placeholder={placeholder}
              aria-label={placeholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              onClick={prefillDraft}
              onFocus={prefillDraft}
            />
            <button type="button" className="dela-panel__input-action" aria-label="Attach file">
              <Icon name="paperclip" size="md" />
            </button>
            <button type="button" className="dela-panel__input-action" aria-label="Use microphone">
              <Icon name="microphone" size="md" />
            </button>
            <button
              type="button"
              className="dela-panel__input-action dela-panel__input-action--send"
              aria-label="Send message"
              disabled={!canSend}
              onClick={sendDraft}
            >
              <Icon name="paper-airplane" size="md" />
            </button>
          </div>
        </div>

        <div className="dela-panel__footer">
          <Icon name="information-circle" size="sm" />
          <span>{disclaimer}</span>
        </div>
        </>
      )}
    </div>
  )
}
