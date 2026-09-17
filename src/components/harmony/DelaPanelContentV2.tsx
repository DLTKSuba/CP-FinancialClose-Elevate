import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { Button } from './Button'
import { Dropdown } from './Dropdown'
import { DelaChatHistory, setCloseRunHistoryStatus } from './DelaChatHistory'
import type { DelaChatStatus } from './DelaChatHistory'
import './DelaPanelContent.css'

/** Independent copy of the Dela close-period prototype for Version 2. */

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
  | 'processing-automatically'
  | 'reviewing-transactions'
  | 'running-closing-job'
  | 'close-job-started'
  | 'missing-default-job'
  | 'cancelled'

/** Message Dela shows under the "Running close job" header for each run state.
   Statuses without an image fall back to the Harmony warning icon. */
const CLOSE_RUN_MESSAGE: Record<
  DelaChatStatus,
  { text: string; tone: 'info' | 'success' | 'warning'; image?: string }
> = {
  Running: {
    text: "Close is in progress — you'll be notified when it's complete.",
    tone: 'info',
    image: '/InfoFilled.png',
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

function CloseRunStatusReply({ status }: { status: DelaChatStatus }) {
  const message = CLOSE_RUN_MESSAGE[status]
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
const ENTITY_NAME = 'Enterprise Foundation'

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
  { label: 'Vouchers', count: 2 },
  { label: 'Journal entries', count: 6 },
  { label: 'Other transactions', count: 10 },
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

/** Last calendar day of the selected period, e.g. `Sep 30, 2026`. */
const periodEndDate = (fiscalYear: string, period: string) => {
  const end = new Date(calendarYear(fiscalYear), Number(period), 0)
  return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const periodStatus = (fiscalYear: string, period: string) => {
  const yearDelta = calendarYear(fiscalYear) - calendarYear(CURRENT_FISCAL_YEAR)
  const periodDelta = Number(period) - Number(CURRENT_PERIOD)
  const delta = yearDelta !== 0 ? yearDelta : periodDelta
  if (delta < 0) return 'closed'
  if (delta === 0) return 'open'
  return 'not open yet'
}

export interface DelaPanelContentV2Props {
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
  /** Step Dela runs after the period is confirmed. */
  nextStepHint?: string
}

export function DelaPanelContentV2({
  greeting = 'What’s on the agenda today?',
  placeholder = 'Ask Dela Anything...',
  disclaimer = 'Disclaimer',
  suggestedPrompt = 'Close period',
  closeThroughDelaEnabled = true,
  missingDefaultJob = false,
  nextStepHint = 'Next: checking for unposted transactions',
}: DelaPanelContentV2Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [messages, setMessages] = useState<DelaMessage[]>([])
  const [startedOn, setStartedOn] = useState('')
  const [phase, setPhase] = useState<ClosePeriodPhase>('idle')
  const [fiscalYear, setFiscalYear] = useState(CURRENT_FISCAL_YEAR)
  const [period, setPeriod] = useState(CURRENT_PERIOD)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const [postedSteps, setPostedSteps] = useState(0)
  const [postingOpen, setPostingOpen] = useState(false)
  const [closingJobSteps, setClosingJobSteps] = useState(0)
  const [closingJobOpen, setClosingJobOpen] = useState(false)
  /** Drives the close-job message; history chats reopen with their tag's state. */
  const [closeRunStatus, setCloseRunStatus] = useState<DelaChatStatus>('Running')
  const [selectedCloseJob, setSelectedCloseJob] = useState('')

  const hasConversation = messages.length > 0
  const canSend = draft.trim() !== ''
  /** The period is settled once Continue starts the transaction check. */
  const periodConfirmed =
    phase === 'checking-transactions' ||
    phase === 'transactions-found' ||
    phase === 'processing-automatically' ||
    phase === 'reviewing-transactions' ||
    phase === 'running-closing-job' ||
    phase === 'close-job-started' ||
    phase === 'missing-default-job'
  /** Once the user picks a handling option the finding collapses to a done step. */
  const transactionsHandled =
    phase === 'processing-automatically' ||
    phase === 'reviewing-transactions' ||
    phase === 'running-closing-job' ||
    phase === 'missing-default-job' ||
    phase === 'close-job-started'
  const postingComplete = postedSteps >= POSTING_STEPS.length
  const closingJobComplete = closingJobSteps >= CLOSING_JOB_STEPS.length
  const isDefaultPeriod = fiscalYear === CURRENT_FISCAL_YEAR && period === CURRENT_PERIOD

  const periodSummary = useMemo(
    () => ({
      title: `${MONTHS[Number(period) - 1]} ${calendarYear(fiscalYear)} · Period ${period}`,
      detail: `${ENTITY_NAME} · ${periodStatus(fiscalYear, period)} · ends ${periodEndDate(
        fiscalYear,
        period
      )}`,
    }),
    [fiscalYear, period]
  )

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

  const sendDraft = useCallback(() => {
    const text = draft.trim()
    if (text === '') return
    setMessages((prev) => {
      if (prev.length === 0) {
        setStartedOn(new Date().toLocaleDateString())
        setPhase('checking-readiness')
        setFiscalYear(CURRENT_FISCAL_YEAR)
        setPeriod(CURRENT_PERIOD)
        setPeriodOpen(false)
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
    setDraft('')
    setMessages([])
    setStartedOn('')
    setPhase('idle')
    setCloseRunStatus('Running')
    setFiscalYear(CURRENT_FISCAL_YEAR)
    setPeriod(CURRENT_PERIOD)
    setPeriodOpen(false)
    setTransactionsOpen(false)
    setPostedSteps(0)
    setPostingOpen(false)
    setClosingJobSteps(0)
    setClosingJobOpen(false)
    setSelectedCloseJob('')
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
            setHistoryOpen((open) => !open)
          }}
        >
          <Icon name="clock" size="md" />
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

      {historyOpen && !missingDefaultJob ? (
        <DelaChatHistory
          onBack={() => setHistoryOpen(false)}
          onSelect={(entry) => {
            setHistoryOpen(false)
            /* Close runs reopen their finished conversation; other chats just prefill. */
            if (entry.status) {
              setMessages([{ id: `dela-message-${entry.id}`, text: entry.title }])
              setStartedOn(entry.askedOn.toLocaleDateString())
              setCloseRunStatus(entry.status)
              setPhase('close-job-started')
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
                    {phase === 'checking-readiness' ? (
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

                    {/* The confirm form stays put while the transactions prompt lands underneath it */}
                    {phase === 'form' && (
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
                            />
                            <Dropdown
                              id="dela-close-period"
                              name="period"
                              options={PERIOD_OPTIONS}
                              value={period}
                              onChange={setPeriod}
                            />
                          </div>
                        </div>

                        <div className="dela-panel__period-card">
                          <div className="dela-panel__period-card-text">
                            <p className="dela-panel__period-title">{periodSummary.title}</p>
                            <p className="dela-panel__period-detail">{periodSummary.detail}</p>
                          </div>
                          {isDefaultPeriod && (
                            <Badge variant="success" size="small">
                              Default
                            </Badge>
                          )}
                        </div>

                        <p className="dela-panel__next-step">
                          <Icon name="arrow-right" size="sm" />
                          <span>{nextStepHint}</span>
                        </p>

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
                      </>
                    )}

                    {periodConfirmed && (
                      <section className="dela-panel__step">
                        <div className="dela-panel__step-row">
                          <img src="/RS_Dela_Active.svg" alt="" />
                          <button
                            type="button"
                            className="dela-panel__readiness-summary"
                            aria-expanded={periodOpen}
                            aria-controls="dela-period-detail"
                            onClick={() => setPeriodOpen((open) => !open)}
                          >
                            <Icon name="check" size="sm" className="dela-panel__check-icon" />
                            <span className="dela-panel__readiness-summary-text">
                              Confirm fiscal year and period
                            </span>
                            <Icon name={periodOpen ? 'chevron-up' : 'chevron-down'} size="sm" />
                          </button>
                        </div>
                        {periodOpen && (
                          <div className="dela-panel__period-card" id="dela-period-detail">
                            <div className="dela-panel__period-card-text">
                              <p className="dela-panel__period-title">{periodSummary.title}</p>
                              <p className="dela-panel__period-detail">{periodSummary.detail}</p>
                            </div>
                            {isDefaultPeriod && (
                              <Badge variant="success" size="small">
                                Default
                              </Badge>
                            )}
                          </div>
                        )}
                      </section>
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

                    {phase === 'transactions-found' && (
                      <section
                        className="dela-panel__transaction-result"
                        aria-labelledby="dela-unposted-transactions-title"
                      >
                        <div className="dela-panel__transaction-heading">
                          <img
                            src="/RS_Dela_Active.svg"
                            alt=""
                            className="dela-panel__transaction-dela-icon"
                          />
                          <Icon
                            name="exclamation-triangle"
                            size="sm"
                            className="dela-panel__warning-icon"
                          />
                          <h4 id="dela-unposted-transactions-title">
                            {UNPOSTED_TRANSACTION_TOTAL} unposted transactions found
                          </h4>
                        </div>

                        {TRANSACTION_CARD}

                        <p className="dela-panel__transaction-question">
                          Would you like me to process these automatically, or review them
                          manually?
                        </p>
                        <div className="dela-panel__transaction-actions">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              if (missingDefaultJob) setSelectedCloseJob('')
                              else {
                                setCloseRunStatus('Running')
                                setCloseRunHistoryStatus('Running')
                              }
                              setPhase(
                                missingDefaultJob
                                  ? 'missing-default-job'
                                  : 'processing-automatically'
                              )
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

                    {phase === 'reviewing-transactions' && (
                      <p className="dela-panel__response">
                        Opening the {UNPOSTED_TRANSACTION_TOTAL} unposted transactions for manual
                        review.
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
                              id="dela-v2-close-job"
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
                                onClick={() => {
                                  setCloseRunStatus('Running')
                                  setCloseRunHistoryStatus('Running')
                                  setPhase('close-job-started')
                                }}
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
                          <CloseRunStatusReply status={closeRunStatus} />
                        )}
                      </section>
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
