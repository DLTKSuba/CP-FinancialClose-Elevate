import { useCallback, useEffect, useId, useMemo, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Routes, Route } from 'react-router-dom'
import { ShellLayout } from './components/harmony/ShellLayout'
import type { ShellLayoutProps } from './components/harmony/ShellLayout'
import type { RightSidebarSection } from './components/harmony/RightSidebar'
import { Card } from './components/harmony/Card'
import { Button } from './components/harmony/Button'
import { TabStrip } from './components/harmony/TabStrip'
import { Table, type SortColumn } from './components/harmony/Table'
import { Dropdown, type Option } from './components/harmony/Dropdown'
import { LifecycleBarChart } from './components/harmony/LifecycleBarChart'
import type { LifecycleBarChartBar } from './components/harmony/LifecycleBarChart'
import { Link } from './components/harmony/Link'
import { Icon } from './components/harmony/Icon'
import { DelaPanelContent } from './components/harmony/DelaPanelContent'
import { DelaPanelContentV2 } from './components/harmony/DelaPanelContentV2'
import { ComponentGalleryPage } from './pages/ComponentGalleryPage'
import { ComponentDemoPage } from './pages/ComponentDemoPage'
import { RightSidebarPanelDemosPage } from './pages/RightSidebarPanelDemosPage'

/** Default product theme for the designer preview (change via document.documentElement.classList if needed). */
const DEFAULT_THEME = 'theme-cp'

const PROTOTYPE_VERSION_OPTIONS: Option[] = [
  { value: 'v1', label: 'V1' },
  { value: 'v2', label: 'Version 2' },
]

const USE_CASE_SCENARIO_OPTIONS: Option[] = [
  { value: 'end-to-end', label: 'End-End experience' },
  { value: 'dela-not-enabled', label: 'Close through a not enabled' },
]

/**
 * Per-theme ShellLayout prop defaults.
 * When DEFAULT_THEME changes, HomeShell automatically picks up the correct
 * footer visibility, floating nav, sidebar variant, product name, and logo.
 */
const THEME_SHELL_PROPS: Record<string, Partial<ShellLayoutProps>> = {
  'theme-cp': {
    productName: 'Agentic Close',
    logoSrc: '/logos/CPVPLogo.svg',
    showFooter: false,
    showFloatingNav: true,
    leftSidebarVariant: 'cp',
    rightSidebarVariant: 'cp',
  },
  'theme-vp': {
    productName: 'VP',
    logoSrc: '/logos/CPVPLogo.svg',
    showFooter: true,
    leftSidebarVariant: 'vp',
    rightSidebarVariant: 'vp',
  },
  'theme-ppm': {
    productName: 'PPM',
    logoSrc: '/logos/PPMLogo.svg',
    showFooter: true,
    leftSidebarVariant: 'ppm',
    rightSidebarVariant: 'ppm',
  },
  'theme-maconomy': {
    productName: 'Maconomy',
    logoSrc: '/logos/MacLogo.svg',
    showFooter: true,
    leftSidebarVariant: 'maconomy',
    rightSidebarVariant: 'maconomy',
  },
}

/** Command Center right rail: Dela + alerts, output, then input/assistance. */
const COMMAND_CENTER_RIGHT_RAIL: RightSidebarSection[] = [
  {
    items: [
      {
        label: 'Dela AI',
        isCustom: true,
        customSrc: '/RS_DelaDefault.svg',
        customSrcActive: '/RS_Dela_OnPrimary.svg',
      },
      { icon: 'bell', label: 'Notifications' },
      { icon: 'upload-download', label: 'Upload and download' },
    ],
  },
  {
    items: [
      { icon: 'printer', label: 'Print' },
      { icon: 'identification', label: 'Details' },
    ],
  },
  {
    items: [
      { icon: 'mic-slash', label: 'Mute microphone' },
      { icon: 'signal-slash', label: 'Mute audio' },
      { icon: 'keyboard', label: 'Keyboard shortcuts' },
      { icon: 'question-mark-circle', label: 'Help' },
    ],
  },
]

/** Command Center primary tabs (Closing Manager reference UI). */
const CC_MAIN_TAB_IDS = ['general-ledger', 'financial-review', 'closing-manager'] as const

const CLOSING_ROLE_OPTIONS: Option[] = [
  { value: 'accountant', label: 'Accountant' },
  { value: 'reviewer', label: 'Reviewer' },
]

const CLOSING_USER_FILTER_ALL = '__all__'
const CLOSING_CURRENT_USER_ID = 'joe'
const CLOSING_ASSIGNEE_MAX = 100

const CLOSING_ASSIGNEE_FIRST_NAMES = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Emma',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'James',
  'Karen',
  'Leo',
  'Maria',
  'Nina',
  'Omar',
  'Paula',
  'Quinn',
  'Rita',
  'Sam',
  'Tina',
  'Uma',
  'Victor',
  'Wendy',
  'Xavier',
  'Yuki',
  'Zoe',
] as const

const CLOSING_ASSIGNEE_LAST_NAMES = [
  'Adams',
  'Baker',
  'Chen',
  'Davis',
  'Evans',
  'Foster',
  'Garcia',
  'Hill',
  'Ivanov',
  'Johnson',
  'Kim',
  'Lee',
  'Martinez',
  'Nguyen',
  'Olsen',
  'Patel',
  'Quinn',
  'Rivera',
  'Smith',
  'Taylor',
  'Upton',
  'Vargas',
  'White',
  'Young',
  'Zhang',
] as const

/** Demo assignees for the Closing Manager user filter (max 100, Joe Smith is current user). */
function buildClosingAssigneeOptions(maxPeople = CLOSING_ASSIGNEE_MAX): Option[] {
  const options: Option[] = [
    { value: CLOSING_CURRENT_USER_ID, label: 'Joe Smith' },
    { value: 'jane', label: 'Jane Doe' },
    { value: 'alice', label: 'Alice Chen' },
    { value: 'bob', label: 'Bob Martinez' },
  ]
  const seenLabels = new Set(options.map((o) => o.label))
  let seq = 0

  while (options.length < maxPeople) {
    const first = CLOSING_ASSIGNEE_FIRST_NAMES[seq % CLOSING_ASSIGNEE_FIRST_NAMES.length]
    const last =
      CLOSING_ASSIGNEE_LAST_NAMES[
        Math.floor(seq / CLOSING_ASSIGNEE_FIRST_NAMES.length) % CLOSING_ASSIGNEE_LAST_NAMES.length
      ]
    const label = `${first} ${last}`
    seq += 1
    if (seenLabels.has(label)) continue
    seenLabels.add(label)
    options.push({ value: `assignee-${seq}`, label })
  }

  return options
}

const BASE_CLOSING_ASSIGNEE_OPTIONS: Option[] = buildClosingAssigneeOptions()

const CLOSING_PROGRESS_BAR_TEMPLATE: Omit<LifecycleBarChartBar, 'value'>[] = [
  {
    id: 'not-started',
    label: 'Not Started',
    color: '#94a3b8',
    description: 'Tasks not yet started',
  },
  {
    id: 'ready',
    label: 'Ready',
    color: '#22c55e',
    description: 'Tasks ready to run',
  },
  {
    id: 'in-process',
    label: 'In-Process',
    color: '#eab308',
    description: 'Tasks in progress',
  },
  {
    id: 'waiting',
    label: 'Waiting',
    color: '#ef4444',
    description: 'Tasks waiting on dependencies',
  },
]

const CLOSING_PLAN_SORT_COLUMNS_BASE: SortColumn[] = [
  { key: 'category', label: 'Category' },
  { key: 'task', label: 'Task' },
  { key: 'application', label: 'Application Name' },
  { key: 'closingDay', label: 'Closing Day' },
  { key: 'status', label: 'Status' },
]

const CLOSING_PLAN_SORT_COLUMNS_WITH_USER: SortColumn[] = [
  { key: 'category', label: 'Category' },
  { key: 'task', label: 'Task' },
  { key: 'application', label: 'Application Name' },
  { key: 'user', label: 'User' },
  { key: 'closingDay', label: 'Closing Day' },
  { key: 'status', label: 'Status' },
]

type ClosingTaskStatus = 'waiting' | 'in-process' | 'ready'

type ClosingPlanTaskRow = {
  id: string
  category: string
  task: string
  applicationName: string | null
  applicationHref?: string
  closingDay: string
  status: ClosingTaskStatus
  /** Assignee for Command Center user filter demo. */
  assigneeId: string
  /** Display name for User column when multiple / all assignees are in scope. */
  assigneeName: string
}

/** Shown when a single assignee is selected (narrow view). */
const CLOSING_PLAN_TASK_ROWS_BASE: ClosingPlanTaskRow[] = [
  {
    id: '1',
    category: 'Financial Analysis',
    task: 'Add PL Table with metrics and drills',
    applicationName: null,
    closingDay: 'Day 1',
    status: 'waiting',
    assigneeId: 'joe',
    assigneeName: 'Joe Smith (You)',
  },
  {
    id: '2',
    category: 'Financial Analysis',
    task: 'Budgets for Fin Metrics',
    applicationName: null,
    closingDay: 'Day 2',
    status: 'in-process',
    assigneeId: 'jane',
    assigneeName: 'Jane Doe',
  },
  {
    id: '3',
    category: 'Financial Analysis',
    task: 'Finalize Journal Entries',
    applicationName: 'Manage Journal Entries',
    applicationHref: '#',
    closingDay: 'Day 1',
    status: 'ready',
    assigneeId: 'alice',
    assigneeName: 'Alice Chen',
  },
]

/** Extra tasks when “All users” or multiple assignees are selected (broader plan view). */
const CLOSING_PLAN_TASK_ROWS_EXTENDED: ClosingPlanTaskRow[] = [
  {
    id: '4',
    category: 'Period Close',
    task: 'Validate subledger tie-outs',
    applicationName: 'Subledger Control',
    applicationHref: '#',
    closingDay: 'Day 1',
    status: 'in-process',
    assigneeId: 'joe',
    assigneeName: 'Joe Smith (You)',
  },
  {
    id: '5',
    category: 'Period Close',
    task: 'Run allocation sets',
    applicationName: null,
    closingDay: 'Day 2',
    status: 'waiting',
    assigneeId: 'jane',
    assigneeName: 'Jane Doe',
  },
  {
    id: '6',
    category: 'Reporting',
    task: 'Publish management flash',
    applicationName: 'FR Studio',
    applicationHref: '#',
    closingDay: 'Day 2',
    status: 'ready',
    assigneeId: 'alice',
    assigneeName: 'Alice Chen',
  },
  {
    id: '7',
    category: 'Reporting',
    task: 'Reconcile intercompany eliminations',
    applicationName: null,
    closingDay: 'Day 3',
    status: 'waiting',
    assigneeId: 'bob',
    assigneeName: 'Bob Martinez',
  },
  {
    id: '8',
    category: 'Compliance',
    task: 'SOX control sign-off package',
    applicationName: 'GRC Workspace',
    applicationHref: '#',
    closingDay: 'Day 3',
    status: 'in-process',
    assigneeId: 'joe',
    assigneeName: 'Joe Smith (You)',
  },
  {
    id: '9',
    category: 'Compliance',
    task: 'Document variance thresholds',
    applicationName: null,
    closingDay: 'Day 4',
    status: 'ready',
    assigneeId: 'bob',
    assigneeName: 'Bob Martinez',
  },
  {
    id: '10',
    category: 'Cash',
    task: 'Bank reconciliation sweep',
    applicationName: 'Cash Management',
    applicationHref: '#',
    closingDay: 'Day 1',
    status: 'ready',
    assigneeId: 'alice',
    assigneeName: 'Alice Chen',
  },
  {
    id: '11',
    category: 'Cash',
    task: 'Confirm wire cutoff times',
    applicationName: null,
    closingDay: 'Day 2',
    status: 'waiting',
    assigneeId: 'jane',
    assigneeName: 'Jane Doe',
  },
]

function closingTaskStatusBadge(status: ClosingTaskStatus) {
  const map: Record<
    ClosingTaskStatus,
    { label: string; className: string }
  > = {
    waiting: { label: 'Waiting', className: 'closing-task-status closing-task-status--waiting' },
    'in-process': {
      label: 'In Process',
      className: 'closing-task-status closing-task-status--in-process',
    },
    ready: { label: 'Ready', className: 'closing-task-status closing-task-status--ready' },
  }
  const { label, className } = map[status]
  return <span className={className}>{label}</span>
}

function closingPlanShowUserColumn(userFilters: string[]): boolean {
  const allSelected =
    userFilters.length === 1 && userFilters[0] === CLOSING_USER_FILTER_ALL
  const selectedIds = userFilters.filter((id) => id !== CLOSING_USER_FILTER_ALL)
  return allSelected || selectedIds.length > 1
}

function closingPlanTaskPool(userFilters: string[]): ClosingPlanTaskRow[] {
  const expanded = closingPlanShowUserColumn(userFilters)
  return expanded
    ? [...CLOSING_PLAN_TASK_ROWS_BASE, ...CLOSING_PLAN_TASK_ROWS_EXTENDED]
    : CLOSING_PLAN_TASK_ROWS_BASE
}

/** Tasks visible for the current assignee filter (All tasks, My tasks, or selected people). */
function closingTasksForFilters(userFilters: string[]): ClosingPlanTaskRow[] {
  const showAll =
    userFilters.length === 1 && userFilters[0] === CLOSING_USER_FILTER_ALL
  const pool = closingPlanTaskPool(userFilters)
  return showAll ? pool : pool.filter((row) => userFilters.includes(row.assigneeId))
}

type ClosingMetricsSummary = {
  openTasks: number
  totalTasks: number
  percentClosed: number
}

function closingMetricsFromTasks(tasks: ClosingPlanTaskRow[]): ClosingMetricsSummary {
  const totalTasks = tasks.length
  const closedCount = tasks.filter((t) => t.status === 'ready').length
  const openTasks = totalTasks - closedCount
  const percentClosed =
    totalTasks === 0 ? 0 : Math.round((closedCount / totalTasks) * 100)
  return { openTasks, totalTasks, percentClosed }
}

function closingProgressBarsFromTasks(tasks: ClosingPlanTaskRow[]): LifecycleBarChartBar[] {
  const counts: Record<string, number> = {
    'not-started': 0,
    ready: 0,
    'in-process': 0,
    waiting: 0,
  }
  for (const task of tasks) {
    if (task.status in counts) {
      counts[task.status] += 1
    }
  }
  return CLOSING_PROGRESS_BAR_TEMPLATE.map((bar) => ({
    ...bar,
    value: counts[bar.id] ?? 0,
  }))
}

function closingProgressChartYAxisMax(bars: LifecycleBarChartBar[]): number {
  const maxVal = Math.max(0, ...bars.map((b) => b.value))
  if (maxVal <= 0) return 3
  if (maxVal <= 3) return 3
  if (maxVal <= 5) return 5
  if (maxVal <= 10) return 10
  return Math.ceil(maxVal / 5) * 5
}

function assigneeLabelForRow(
  row: ClosingPlanTaskRow,
  assigneeOptions: Option[]
): string {
  return assigneeOptions.find((o) => o.value === row.assigneeId)?.label ?? row.assigneeName
}

function ClosingPlanTasksTableBody({
  userFilters,
  assigneeOptions,
  showUserColumn,
}: {
  userFilters: string[]
  assigneeOptions: Option[]
  showUserColumn: boolean
}) {
  const visibleRows = closingTasksForFilters(userFilters)

  const colSpan = showUserColumn ? 6 : 5

  return (
    <tbody>
      {visibleRows.length === 0 ? (
        <tr>
          <td colSpan={colSpan} className="text-left text-secondary">
            No tasks match the selected users.
          </td>
        </tr>
      ) : (
        visibleRows.map((row) => (
          <tr key={row.id}>
            <td className="text-left">{row.category}</td>
            <td className="text-left">{row.task}</td>
            <td className="text-left">
              {row.applicationName == null ? (
                '\u00A0'
              ) : row.applicationHref ? (
                <Link href={row.applicationHref}>{row.applicationName}</Link>
              ) : (
                row.applicationName
              )}
            </td>
            {showUserColumn ? (
              <td className="text-left">{assigneeLabelForRow(row, assigneeOptions)}</td>
            ) : null}
            <td className="text-left">{row.closingDay}</td>
            <td className="text-left">{closingTaskStatusBadge(row.status)}</td>
          </tr>
        ))
      )}
    </tbody>
  )
}

const PO_DETAIL_TAB_PREFIX = 'po-detail:' as const

export function poDetailTabId(poId: string) {
  return `${PO_DETAIL_TAB_PREFIX}${poId}`
}

function isPoDetailTabId(id: string) {
  return id.startsWith(PO_DETAIL_TAB_PREFIX)
}

export function poIdFromDetailTabId(id: string): string | null {
  if (!isPoDetailTabId(id)) return null
  return id.slice(PO_DETAIL_TAB_PREFIX.length)
}

const PR_DETAIL_TAB_PREFIX = 'pr-detail:' as const

export function prDetailTabId(prId: string) {
  return `${PR_DETAIL_TAB_PREFIX}${prId}`
}

function isPrDetailTabId(id: string) {
  return id.startsWith(PR_DETAIL_TAB_PREFIX)
}

export function prIdFromDetailTabId(id: string): string | null {
  if (!isPrDetailTabId(id)) return null
  return id.slice(PR_DETAIL_TAB_PREFIX.length)
}

type RequisitionRow = {
  id: string
  vendorId: string
  vendor: string
  amount: string
  statusLabel: string
  stageIndices: readonly number[]
  overdue: string
  overdueUrgent?: boolean
  requestedBy: string
  organization: string
  createdDate: string
  needBy: string
  /** Optional copy for the yellow stat strip above Summary (empty hides the line). */
  bannerMessage: string
  /** Lines assigned to the logged-in buyer (Summary). */
  buyerAssignedLineCount: number
  /** Late lines per lifecycle stage for Late Items panel (indices match REQ_STATUS_STAGE_LABELS). */
  lateItemsStageCounts: readonly [number, number, number, number]
  requisitionerName: string
  requisitionerEmail: string
}

type RequisitionLineRow = {
  line: string
  status: string
  projectId: string
  projectName: string
  item: string
  rev: string
  itemDesc: string
  lnStatus: string
  preferredVendor: string
  targetPlaceDate: string
  daysUntilTarget: number
  nextApprover: string
  qty: string
  unitCost: string
  lineTotalCost: string
  accountId: string
  accountName: string
  orgId: string
  orgName: string
}

const REQUISITION_ROWS: RequisitionRow[] = [
  {
    id: 'PR-2041',
    vendorId: 'VND-900101',
    vendor: 'Acme Office Supplies',
    amount: '$1,250.00',
    statusLabel: 'In-Approval',
    stageIndices: [0, 2],
    overdue: '2/5',
    overdueUrgent: true,
    requestedBy: 'Alex Rivera',
    organization: 'HQ — Procurement',
    createdDate: 'Apr 2, 2025',
    needBy: 'Apr 18, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 4,
    lateItemsStageCounts: [1, 0, 1, 0],
    requisitionerName: 'Jamie Chen',
    requisitionerEmail: 'jamie.chen@contoso.com',
  },
  {
    id: 'PR-2045',
    vendorId: 'VND-900205',
    vendor: 'Litware Medical Devices',
    amount: '$3,890.25',
    statusLabel: 'In-Approval',
    stageIndices: [0, 2],
    overdue: '1/6',
    overdueUrgent: true,
    requestedBy: 'Sam Lee',
    organization: 'Region NA — Ops',
    createdDate: 'Mar 28, 2025',
    needBy: 'Apr 22, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 6,
    lateItemsStageCounts: [0, 0, 1, 0],
    requisitionerName: 'Sam Lee',
    requisitionerEmail: 'sam.lee@contoso.com',
  },
  {
    id: 'PR-2042',
    vendorId: 'VND-900302',
    vendor: 'Northwind Logistics LLC',
    amount: '$8,420.50',
    statusLabel: 'Pending PO Creation',
    stageIndices: [0, 2, 3],
    overdue: '1/4',
    overdueUrgent: true,
    requestedBy: 'Jordan Smith',
    organization: 'HQ — Finance',
    createdDate: 'Mar 15, 2025',
    needBy: 'Apr 10, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 3,
    lateItemsStageCounts: [0, 0, 0, 1],
    requisitionerName: 'Jordan Smith',
    requisitionerEmail: 'jordan.smith@contoso.com',
  },
  {
    id: 'PR-2048',
    vendorId: 'VND-900448',
    vendor: 'Wide World Importers',
    amount: '$22,150.00',
    statusLabel: 'Pending PO Creation',
    stageIndices: [0, 2, 3],
    overdue: '4/9',
    overdueUrgent: true,
    requestedBy: 'Priya Nair',
    organization: 'EMEA — Supply',
    createdDate: 'Mar 20, 2025',
    needBy: 'Apr 5, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 5,
    lateItemsStageCounts: [1, 0, 2, 1],
    requisitionerName: 'Priya Nair',
    requisitionerEmail: 'priya.nair@contoso.com',
  },
  {
    id: 'PR-2043',
    vendorId: 'VND-900503',
    vendor: 'Contoso Training Group',
    amount: '$2,100.00',
    statusLabel: 'Pending',
    stageIndices: [0],
    overdue: '1/3',
    overdueUrgent: true,
    requestedBy: 'Morgan Chen',
    organization: 'HQ — L&D',
    createdDate: 'Apr 8, 2025',
    needBy: 'Apr 25, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 2,
    lateItemsStageCounts: [1, 0, 0, 0],
    requisitionerName: 'Morgan Chen',
    requisitionerEmail: 'morgan.chen@contoso.com',
  },
  {
    id: 'PR-2046',
    vendorId: 'VND-900606',
    vendor: 'Adventure Works IT',
    amount: '$475.90',
    statusLabel: 'Pending',
    stageIndices: [0],
    overdue: '0/2',
    requestedBy: 'Casey Brooks',
    organization: 'IT — Infrastructure',
    createdDate: 'Apr 1, 2025',
    needBy: 'Apr 30, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 1,
    lateItemsStageCounts: [0, 0, 0, 0],
    requisitionerName: 'Casey Brooks',
    requisitionerEmail: 'casey.brooks@contoso.com',
  },
  {
    id: 'PR-2044',
    vendorId: 'VND-900704',
    vendor: 'Fabrikam Facilities Inc.',
    amount: '$640.00',
    statusLabel: 'Rejected',
    stageIndices: [0, 1],
    overdue: '1/2',
    overdueUrgent: true,
    requestedBy: 'Riley Ortiz',
    organization: 'Facilities — West',
    createdDate: 'Feb 10, 2025',
    needBy: 'Mar 1, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 0,
    lateItemsStageCounts: [0, 1, 0, 0],
    requisitionerName: 'Riley Ortiz',
    requisitionerEmail: 'riley.ortiz@contoso.com',
  },
  {
    id: 'PR-2047',
    vendorId: 'VND-900807',
    vendor: 'Blue Yonder Analytics',
    amount: '$9,999.00',
    statusLabel: 'Rejected',
    stageIndices: [0, 2, 1],
    overdue: '3/3',
    overdueUrgent: true,
    requestedBy: 'Taylor Kim',
    organization: 'HQ — Analytics',
    createdDate: 'Jan 22, 2025',
    needBy: 'Feb 28, 2025',
    bannerMessage: '',
    buyerAssignedLineCount: 8,
    lateItemsStageCounts: [0, 1, 1, 1],
    requisitionerName: 'Taylor Kim',
    requisitionerEmail: 'taylor.kim@contoso.com',
  },
]

function requisitionLineRowsForPr(row: RequisitionRow): RequisitionLineRow[] {
  const preferredVendor = `${row.vendorId} — ${row.vendor}`
  const lineCount = Math.max(10, row.buyerAssignedLineCount)
  return Array.from({ length: lineCount }, (_, i) => {
    const n = i + 1
    const statusEmpty = n === 2
    const qty = n + 1
    const unit = 125.5 * n
    const total = unit * qty
    const itemDescShort =
      n === 1
        ? `Workstation bundle — ${row.vendor}`
        : n % 3 === 0
          ? 'Office supplies kit — catalog'
          : 'Standard hardware line — non-stock'
    return {
      line: String(n),
      status: statusEmpty ? '' : n === 1 ? 'In-Approval' : 'Buyer Review',
      projectId: `PRJ-${2400 + n}`,
      projectName: n % 2 === 0 ? 'HQ Facilities Refresh' : 'Field Services Expansion',
      item: `ITM-${row.id.replace(/^PR-/, '')}-${String(n).padStart(2, '0')}`,
      rev: n === 1 ? 'A' : 'B',
      itemDesc: itemDescShort,
      lnStatus: n === 1 ? 'Open' : 'Submitted',
      preferredVendor,
      targetPlaceDate: row.needBy,
      daysUntilTarget: 22 - n * 7,
      nextApprover: n === 1 ? row.requestedBy : 'Jamie Chen',
      qty: String(qty),
      unitCost: `$${unit.toFixed(2)}`,
      lineTotalCost: `$${total.toFixed(2)}`,
      accountId: 'ACC-4400',
      accountName: 'Operating Expense',
      orgId: 'ORG-HQ',
      orgName: row.organization,
    }
  })
}

function requisitionReportHref(prId: string) {
  return `#/report/requisition/${encodeURIComponent(prId)}`
}

/** Parses table overdue cell like `2/5` → late vs total counts. */
function parseOverdueFraction(overdue: string): { late: number; total: number } | null {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(overdue.trim())
  if (!m) return null
  const late = Number(m[1])
  const total = Number(m[2])
  if (!Number.isFinite(late) || !Number.isFinite(total) || total <= 0) return null
  return { late, total }
}

/** Parses table overdue cell like `2/5` → 40% for the side panel. */
function overdueLinesPercent(overdue: string): number | null {
  const p = parseOverdueFraction(overdue)
  if (!p) return null
  return Math.round((p.late / p.total) * 100)
}

/** Bar colors aligned with PO Command Center reference; requisitions use the first four tones. */
const REQ_LIFECYCLE_COLORS = {
  pendingSubmittal: '#f97316',
  rejected: '#dc2626',
  pendingApproval: '#ec4899',
  pendingPoCreation: '#1d4ed8',
} as const

export const REQUISITION_CHART_BARS: LifecycleBarChartBar[] = [
  {
    id: 'pending-submittal',
    label: 'Pending',
    value: 100,
    color: REQ_LIFECYCLE_COLORS.pendingSubmittal,
    description:
      'PR has been assigned to the Buyer and in Pending status',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    value: 20,
    color: REQ_LIFECYCLE_COLORS.rejected,
    description: 'PR has been assigned to the Buyer and in Rejected status',
  },
  {
    id: 'pending-approval',
    label: 'In-Approval',
    value: 45,
    color: REQ_LIFECYCLE_COLORS.pendingApproval,
    description:
      'PR has been assigned to the Buyer and In-Approval',
  },
  {
    id: 'pending-po-creation',
    label: 'Pending PO Creation',
    value: 60,
    color: REQ_LIFECYCLE_COLORS.pendingPoCreation,
    description:
      'PR has been assigned to the Buyer and Approved',
  },
]

const PO_CHART_BARS: LifecycleBarChartBar[] = [
  { id: 'po-pending-approval', label: 'In-Approval', value: 168, color: '#f97316' },
  { id: 'po-pending-receipt', label: 'Pending Receipt', value: 166, color: '#dc2626' },
  { id: 'po-pending-inspection', label: 'Pending Inspection', value: 40, color: '#ec4899' },
  { id: 'po-awaiting-inv', label: 'Awaiting Invoice', value: 29, color: '#1d4ed8' },
  { id: 'po-pending-inv-approval', label: 'Pending Inv Approval', value: 54, color: '#38bdf8' },
  { id: 'po-awaiting-payment', label: 'Awaiting Payment', value: 39, color: '#9ca3af' },
]

/**
 * Command Center status column (reference: PO / PR lifecycle table).
 * — Solid rounded rectangles (14×14px, 4px radius), not circles.
 * — 6px gap between markers; left-aligned in cell.
 * — Only the relevant lifecycle stages for that row (multi-status = several markers).
 * — Colors match the lifecycle bar chart order (left → right).
 */
const STATUS_COLUMN_VISUAL_SPEC = {
  markerSizePx: 14,
  markerGapPx: 6,
  markerRadiusPx: 4,
} as const

/** Stage index order matches `REQUISITION_CHART_BARS` / bar chart left → right. */
const REQ_STATUS_DOT_COLORS = [
  REQ_LIFECYCLE_COLORS.pendingSubmittal,
  REQ_LIFECYCLE_COLORS.rejected,
  REQ_LIFECYCLE_COLORS.pendingApproval,
  REQ_LIFECYCLE_COLORS.pendingPoCreation,
] as const

const REQ_STATUS_STAGE_LABELS = [
  'Pending',
  'Rejected',
  'In-Approval',
  'Pending PO Creation',
] as const

const PO_LIFECYCLE_STAGE_COLORS = PO_CHART_BARS.map((b) => b.color) as readonly string[]
const PO_LIFECYCLE_STAGE_LABELS = PO_CHART_BARS.map((b) => b.label) as readonly string[]

function commandCenterLifecycleStatusCell(
  entity: 'PR' | 'PO',
  summaryLabel: string,
  colors: readonly string[],
  stageLabels: readonly string[],
  /** Stage indices to render, left → right (subset of lifecycle; order preserved). */
  stageIndicesInDisplayOrder: readonly number[],
) {
  const described = stageIndicesInDisplayOrder.map((i) => stageLabels[i] ?? `Stage ${i}`)
  const { markerSizePx, markerGapPx, markerRadiusPx } = STATUS_COLUMN_VISUAL_SPEC
  return (
    <td className="text-left">
      <span
        role="img"
        aria-label={`${entity} status: ${summaryLabel}. Lifecycle indicators (left to right): ${described.join(', ')}.`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: `${markerGapPx}px`,
        }}
      >
        {stageIndicesInDisplayOrder.map((i, slot) => (
          <span
            key={`${i}-${slot}`}
            style={{
              width: `${markerSizePx}px`,
              height: `${markerSizePx}px`,
              borderRadius: `${markerRadiusPx}px`,
              flexShrink: 0,
              backgroundColor: colors[i],
            }}
          />
        ))}
      </span>
    </td>
  )
}

function reqStatusTrailCell(
  statusLabel: string,
  stageIndicesInDisplayOrder: readonly number[],
  lifecycleChartFilterStageIndices: readonly number[] | null,
) {
  const useChartFilter =
    lifecycleChartFilterStageIndices != null && lifecycleChartFilterStageIndices.length > 0
  const displayIndices = useChartFilter
    ? [...new Set(lifecycleChartFilterStageIndices)].sort((a, b) => a - b)
    : stageIndicesInDisplayOrder
  const summaryLabel = useChartFilter
    ? displayIndices.map((i) => REQ_STATUS_STAGE_LABELS[i] ?? `Stage ${i}`).join(', ')
    : statusLabel
  return commandCenterLifecycleStatusCell(
    'PR',
    summaryLabel,
    REQ_STATUS_DOT_COLORS,
    REQ_STATUS_STAGE_LABELS,
    displayIndices,
  )
}

function poLifecycleStatusCell(
  summaryLabel: string,
  stageIndicesInDisplayOrder: readonly number[],
  lifecycleChartFilterStageIndices: readonly number[] | null,
) {
  const useChartFilter =
    lifecycleChartFilterStageIndices != null && lifecycleChartFilterStageIndices.length > 0
  const displayIndices = useChartFilter
    ? [...new Set(lifecycleChartFilterStageIndices)].sort((a, b) => a - b)
    : stageIndicesInDisplayOrder
  const label = useChartFilter
    ? displayIndices.map((i) => PO_LIFECYCLE_STAGE_LABELS[i] ?? `Stage ${i}`).join(', ')
    : summaryLabel
  return commandCenterLifecycleStatusCell(
    'PO',
    label,
    PO_LIFECYCLE_STAGE_COLORS,
    PO_LIFECYCLE_STAGE_LABELS,
    displayIndices,
  )
}

function prIdCell(id: string) {
  return (
    <td>
      <Link
        href="#"
        size="small"
        title="Apply PO Info to Purchase Requisitions"
        aria-label={`${id}: Apply PO Info to Purchase Requisitions`}
        onClick={(e) => {
          e.preventDefault()
        }}
      >
        {id}
      </Link>
    </td>
  )
}

function commandCenterHeaderTh(
  label: string,
  align: 'left' | 'right' = 'left',
  title?: string,
) {
  const alignClass = align === 'right' ? 'text-right' : 'text-left'
  const icons = (
    <span className="command-center-th__actions" aria-hidden>
      <Icon name="chevron-up-down" size="xs" />
      <Icon name="funnel" size="xs" />
    </span>
  )
  return (
    <th className={alignClass} scope="col" title={title}>
      <span
        className={
          align === 'right'
            ? 'command-center-th command-center-th--end'
            : 'command-center-th'
        }
      >
        <span className="command-center-th__label">{label}</span>
        {icons}
      </span>
    </th>
  )
}

export const REQUISITION_TABLE_HEADER = (
  <thead>
    <tr>
      {commandCenterHeaderTh(
        'PR ID',
        'left',
        'PR ID — link to Apply PO Info to Purchase Requisitions',
      )}
      {commandCenterHeaderTh('Preferred Vendor Name')}
      {commandCenterHeaderTh('Total Amount', 'right')}
      {commandCenterHeaderTh('Status')}
      {commandCenterHeaderTh('Overdue')}
    </tr>
  </thead>
)

const PR_LINE_DETAILS_TABLE_HEADER = (
  <thead>
    <tr>
      {commandCenterHeaderTh('Line')}
      {commandCenterHeaderTh('Status')}
      {commandCenterHeaderTh('Projects')}
      {commandCenterHeaderTh('Item')}
      {commandCenterHeaderTh('Rev')}
      {commandCenterHeaderTh('Item Desc')}
      {commandCenterHeaderTh('Ln Status')}
      {commandCenterHeaderTh('Preferred Vendor')}
      {commandCenterHeaderTh('Target Place date')}
      {commandCenterHeaderTh('Days Until Target Place Date', 'right')}
      {commandCenterHeaderTh('Next Approver')}
      {commandCenterHeaderTh('Qty', 'right')}
      {commandCenterHeaderTh('Unit Cost', 'right')}
      {commandCenterHeaderTh('Line Total Cost', 'right')}
      {commandCenterHeaderTh('Accounts')}
      {commandCenterHeaderTh('Orgs')}
    </tr>
  </thead>
)

function PrLineDetailsTableBody({ rows }: { rows: RequisitionLineRow[] }) {
  const cell = 'command-center-pr-line-details-table__cell'
  return (
    <tbody>
      {rows.map((r) => (
        <tr key={`${r.line}-${r.item}`}>
          <td className={clsx('text-left', cell)}>{r.line}</td>
          <td className={clsx('text-left', cell)}>{r.status ? r.status : '\u00A0'}</td>
          <td className={clsx('text-left', cell)}>
            {r.projectId} — {r.projectName}
          </td>
          <td className={clsx('text-left', cell)}>{r.item}</td>
          <td className={clsx('text-left', cell)}>{r.rev}</td>
          <td className={clsx('text-left', cell)}>{r.itemDesc}</td>
          <td className={clsx('text-left', cell)}>{r.lnStatus}</td>
          <td className={clsx('text-left', cell)}>{r.preferredVendor}</td>
          <td className={clsx('text-left', cell)}>{r.targetPlaceDate}</td>
          <td
            className={clsx('text-right', cell)}
            style={r.daysUntilTarget < 0 ? { color: 'var(--color-error)' } : undefined}
          >
            {r.daysUntilTarget}
          </td>
          <td className={clsx('text-left', cell)}>{r.nextApprover}</td>
          <td className={clsx('text-right', cell)}>{r.qty}</td>
          <td className={clsx('text-right', cell)}>{r.unitCost}</td>
          <td className={clsx('text-right', cell)}>{r.lineTotalCost}</td>
          <td className={clsx('text-left', cell)}>
            {r.accountId} — {r.accountName}
          </td>
          <td className={clsx('text-left', cell)}>
            {r.orgId} — {r.orgName}
          </td>
        </tr>
      ))}
    </tbody>
  )
}

export function RequisitionTableBody({
  rows,
  selectedId,
  onSelectRow,
  lifecycleChartFilterStageIndices = null,
}: {
  rows: RequisitionRow[]
  selectedId: string | null
  onSelectRow: (id: string) => void
  /** When non-empty (bar chart filter), status column shows one marker per selected stage. */
  lifecycleChartFilterStageIndices?: readonly number[] | null
}) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr
          key={row.id}
          className={clsx(
            'command-center-table-row--selectable',
            selectedId === row.id && 'table-row--selected',
          )}
          tabIndex={0}
          aria-selected={selectedId === row.id ? 'true' : 'false'}
          onClick={() => onSelectRow(row.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectRow(row.id)
            }
          }}
        >
          {prIdCell(row.id)}
          <td>{row.vendor}</td>
          <td className="text-right">{row.amount}</td>
          {reqStatusTrailCell(row.statusLabel, row.stageIndices, lifecycleChartFilterStageIndices ?? null)}
          <td style={row.overdueUrgent ? { color: 'var(--color-error)' } : undefined}>{row.overdue}</td>
        </tr>
      ))}
    </tbody>
  )
}

export function RequisitionSidePanel({
  row,
  onClose,
  onOpenRequisitionReportTab,
}: {
  row: RequisitionRow
  onClose: () => void
  onOpenRequisitionReportTab: (prId: string) => void
}) {
  const reportHref = requisitionReportHref(row.id)
  const frac = parseOverdueFraction(row.overdue)
  const overduePct = overdueLinesPercent(row.overdue)
  return (
    <aside
      className="command-center-requisition-panel"
      aria-label={`Requisition details for ${row.id}`}
      aria-labelledby="cc-req-panel-title"
    >
      <header className="command-center-requisition-panel__header">
        <h2 className="command-center-requisition-panel__title" id="cc-req-panel-title">
          Purchase Requisitions
        </h2>
        <button
          type="button"
          className="command-center-requisition-panel__close"
          aria-label="Close panel"
          onClick={onClose}
        >
          <Icon name="x-mark" size="sm" />
        </button>
      </header>
      <div className="command-center-requisition-panel__intro">
        <div className="command-center-requisition-panel__pr-row">
          <span className="command-center-requisition-panel__pr-id">{row.id}</span>
          <Link
            href={reportHref}
            size="small"
            title="Open Purchase Requisition Report in a Command Center tab"
            onClick={(e) => {
              e.preventDefault()
              onOpenRequisitionReportTab(row.id)
            }}
          >
            Purchase Requisition Report
          </Link>
        </div>
      </div>
      <div className="command-center-requisition-panel__overdue-strip">
        <div
          className="command-center-requisition-panel__stat-callout"
          aria-label={(() => {
            const base =
              frac != null && overduePct != null
                ? `Overdue lines ${frac.late} of ${frac.total}, ${overduePct} percent`
                : `Overdue lines ${row.overdue}`
            const extra = row.bannerMessage.trim()
            return extra !== '' ? `${base}. ${extra}` : base
          })()}
        >
          <p className="command-center-requisition-panel__stat-callout-pct">
            {overduePct != null ? `${overduePct}%` : row.overdue}
          </p>
          <p className="command-center-requisition-panel__stat-callout-label">Overdue lines</p>
          {row.bannerMessage.trim() !== '' && (
            <p className="command-center-requisition-panel__stat-callout-desc">{row.bannerMessage}</p>
          )}
        </div>
      </div>
      <div className="command-center-requisition-panel__body">
        <RequisitionDetailSummary row={row} />
        <RequisitionLateItemsSection row={row} />
      </div>
    </aside>
  )
}

const SUMMARY_LINES_LABEL_TITLE =
  'Only lines assigned to the logged in Buyer' as const

function RequisitionDetailSummary({ row }: { row: RequisitionRow }) {
  const mailtoHref = `mailto:${row.requisitionerEmail}`
  const [summaryOpen, setSummaryOpen] = useState(true)

  useEffect(() => {
    setSummaryOpen(true)
  }, [row.id])

  return (
    <details
      className="command-center-requisition-accordion"
      open={summaryOpen}
      onToggle={(event) => setSummaryOpen(event.currentTarget.open)}
    >
      <summary className="command-center-requisition-accordion__summary">
        <span className="command-center-requisition-accordion__summary-main">
          <Icon
            name="chevron-right"
            size="sm"
            className="command-center-requisition-accordion__expand-icon"
            aria-hidden
          />
          <span className="command-center-requisition-accordion__summary-text">Summary</span>
        </span>
      </summary>
      <div className="command-center-requisition-accordion__content">
        <div className="command-center-requisition-summary__grid">
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">PR ID</div>
            <div className="command-center-requisition-summary__value">{row.id}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Preferred Vendor Name</div>
            <div className="command-center-requisition-summary__value">{row.vendor}</div>
          </div>
          <div className="command-center-requisition-summary__field" title={SUMMARY_LINES_LABEL_TITLE}>
            <div className="command-center-requisition-summary__label">No. of Lines</div>
            <div className="command-center-requisition-summary__value">{row.buyerAssignedLineCount}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Requisitioner Name</div>
            <div className="command-center-requisition-summary__value">
              <Link
                href={mailtoHref}
                size="medium"
                title={row.requisitionerEmail}
                aria-label={`Email ${row.requisitionerName} at ${row.requisitionerEmail}`}
              >
                {row.requisitionerName}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}

function RequisitionLateItemsSection({ row }: { row: RequisitionRow }) {
  const [lateOpen, setLateOpen] = useState(true)

  useEffect(() => {
    setLateOpen(true)
  }, [row.id])

  const frac = parseOverdueFraction(row.overdue)
  const lateStatusEntries = row.lateItemsStageCounts
    .map((count, stageIndex) => ({ count, stageIndex }))
    .filter(({ count }) => count > 0)

  return (
    <details
      className="command-center-requisition-accordion"
      open={lateOpen}
      onToggle={(event) => setLateOpen(event.currentTarget.open)}
    >
      <summary className="command-center-requisition-accordion__summary">
        <span className="command-center-requisition-accordion__summary-main">
          <Icon
            name="chevron-right"
            size="sm"
            className="command-center-requisition-accordion__expand-icon"
            aria-hidden
          />
          <span className="command-center-requisition-accordion__summary-text">Late Items</span>
        </span>
      </summary>
      <div className="command-center-requisition-accordion__content">
        <div className="command-center-requisition-late-items">
          <div
            className="command-center-requisition-late-items__vs-value"
            aria-label={frac != null ? `Late ${frac.late} of ${frac.total} lines` : `Overdue lines ${row.overdue}`}
          >
            {frac != null ? (
              <>
                <span className="command-center-requisition-late-items__vs-segment">
                  <span className="command-center-requisition-late-items__vs-num command-center-requisition-late-items__vs-num--overdue">
                    {frac.late}
                  </span>
                  <sub className="command-center-requisition-late-items__vs-sub">Overdue</sub>
                </span>
                <span className="command-center-requisition-late-items__vs-divider" aria-hidden />
                <span className="command-center-requisition-late-items__vs-segment">
                  <span className="command-center-requisition-late-items__vs-num command-center-requisition-late-items__vs-num--total">
                    {frac.total}
                  </span>
                  <sub className="command-center-requisition-late-items__vs-sub">Total</sub>
                </span>
              </>
            ) : (
              row.overdue.trim()
            )}
          </div>
          {lateStatusEntries.length > 0 && (
            <div className="command-center-requisition-late-items__sections" role="list">
              {lateStatusEntries.map(({ count, stageIndex }) => {
                const label = REQ_STATUS_STAGE_LABELS[stageIndex] ?? `Stage ${stageIndex}`
                const color = REQ_STATUS_DOT_COLORS[stageIndex] ?? '#94a3b8'
                return (
                  <section
                    key={label}
                    className="command-center-requisition-late-items__status-section"
                    role="listitem"
                    aria-label={`${label}, ${count} overdue lines`}
                  >
                    <div className="command-center-requisition-late-items__status-section-inner">
                      <div className="command-center-requisition-late-items__status-top-row">
                        <div className="command-center-requisition-late-items__status-title-row">
                          <span
                            className="command-center-requisition-late-items__swatch"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <span className="command-center-requisition-late-items__status-name">{label}</span>
                        </div>
                        <Link
                          href="#"
                          size="medium"
                          className="command-center-requisition-late-items__followup"
                          title={`Follow up on ${label}`}
                          aria-label={`Follow up on ${label}`}
                          onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                            e.preventDefault()
                          }}
                        >
                          Follow up
                        </Link>
                      </div>
                      <div className="command-center-requisition-late-items__status-count-below">{count}</div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </details>
  )
}

type PoOrderSummaryFields = {
  release: string
  buyer: string
  type: string
  numberOfLines: number
  vendorName: string
  dueDate: string
  dpasRating: string
}

/** PR Summary fields for order detail (reference layout). */
const PO_ORDER_SUMMARY_BY_ID: Record<string, PoOrderSummaryFields> = {
  'PO-1039': {
    release: 'REL-2024-001',
    buyer: 'John Smith',
    type: 'Standard',
    numberOfLines: 24,
    vendorName: 'Industrial Supply Co.',
    dueDate: '11/15/2024',
    dpasRating: 'Y',
  },
  'PO-1040': {
    release: 'REL-2024-014',
    buyer: 'Alex Rivera',
    type: 'Blanket',
    numberOfLines: 12,
    vendorName: 'Northwind Logistics',
    dueDate: '12/02/2024',
    dpasRating: 'N',
  },
  'PO-1041': {
    release: 'REL-2024-022',
    buyer: 'Priya Nair',
    type: 'Sub Contract',
    numberOfLines: 8,
    vendorName: 'Contoso Services',
    dueDate: '01/08/2025',
    dpasRating: 'Y',
  },
}

type PoTableRowData = {
  id: string
  release: string
  type: string
  vendor: string
  amount: string
  statusLabel: string
  stageIndices: readonly number[]
  overdueLines: string
  overdueUrgent?: boolean
}

export const PO_TABLE_ROWS: PoTableRowData[] = [
  {
    id: 'PO-1039',
    release: 'REL-2024-001',
    type: 'Standard PO',
    vendor: 'Acme Office Co.',
    amount: '$12,400.00',
    statusLabel: 'Awaiting invoice, receipt, pending approval',
    stageIndices: [3, 1, 0],
    overdueLines: '5/7',
    overdueUrgent: true,
  },
  {
    id: 'PO-1040',
    release: 'REL-2024-014',
    type: 'Blanket PO',
    vendor: 'Northwind Logistics',
    amount: '$3,210.50',
    statusLabel: 'Awaiting invoice and receipt',
    stageIndices: [3, 1],
    overdueLines: '2/4',
    overdueUrgent: true,
  },
  {
    id: 'PO-1041',
    release: 'REL-2024-022',
    type: 'Sub Contract',
    vendor: 'Contoso Services',
    amount: '$18,990.00',
    statusLabel: 'Inspection, receipt, pending approval',
    stageIndices: [2, 1, 0],
    overdueLines: '0/3',
  },
]

export const PO_TABLE_HEADER = (
  <thead>
    <tr>
      {commandCenterHeaderTh('PO ID')}
      {commandCenterHeaderTh('Release')}
      {commandCenterHeaderTh('Type')}
      {commandCenterHeaderTh('Vendor Name')}
      {commandCenterHeaderTh('Total Amt', 'right')}
      {commandCenterHeaderTh('Status')}
      {commandCenterHeaderTh('Overdue Lines', 'right')}
    </tr>
  </thead>
)

export function PoPurchaseOrdersTableBody({
  rows,
  onOpenOrder,
  lifecycleChartFilterStageIndices = null,
}: {
  rows: PoTableRowData[]
  onOpenOrder: (poId: string) => void
  lifecycleChartFilterStageIndices?: readonly number[] | null
}) {
  return (
    <tbody>
      {rows.map((row) => (
        <tr key={row.id}>
          <td>
            <Link
              href="#"
              size="small"
              title={`Open order details for ${row.id}`}
              aria-label={`Open order details for ${row.id}`}
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault()
                onOpenOrder(row.id)
              }}
            >
              {row.id}
            </Link>
          </td>
          <td>{row.release}</td>
          <td>{row.type}</td>
          <td>{row.vendor}</td>
          <td className="text-right">{row.amount}</td>
          {poLifecycleStatusCell(row.statusLabel, row.stageIndices, lifecycleChartFilterStageIndices ?? null)}
          <td
            className="text-right"
            style={row.overdueUrgent ? { color: 'var(--color-error)' } : undefined}
          >
            {row.overdueLines}
          </td>
        </tr>
      ))}
    </tbody>
  )
}

function PoOrderPrSummaryAccordion({ poId }: { poId: string }) {
  const summary = PO_ORDER_SUMMARY_BY_ID[poId] ?? PO_ORDER_SUMMARY_BY_ID['PO-1039']
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true)
  }, [poId])

  return (
    <details
      className="command-center-requisition-accordion"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="command-center-requisition-accordion__summary">
        <span className="command-center-requisition-accordion__summary-main">
          <Icon
            name="chevron-right"
            size="sm"
            className="command-center-requisition-accordion__expand-icon"
            aria-hidden
          />
          <span className="command-center-requisition-accordion__summary-text">PR Summary: {poId}</span>
        </span>
      </summary>
      <div className="command-center-requisition-accordion__content">
        <div className="command-center-requisition-summary__grid">
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Release</div>
            <div className="command-center-requisition-summary__value">{summary.release}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Buyer</div>
            <div className="command-center-requisition-summary__value">{summary.buyer}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Type</div>
            <div className="command-center-requisition-summary__value">{summary.type}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Number of Lines</div>
            <div className="command-center-requisition-summary__value">{summary.numberOfLines}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Vendor Name</div>
            <div className="command-center-requisition-summary__value">{summary.vendorName}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">Due Date</div>
            <div className="command-center-requisition-summary__value">{summary.dueDate}</div>
          </div>
          <div className="command-center-requisition-summary__field">
            <div className="command-center-requisition-summary__label">DPAS Rating</div>
            <div className="command-center-requisition-summary__value">{summary.dpasRating}</div>
          </div>
        </div>
      </div>
    </details>
  )
}

export function PoOrderDetailView({ poId }: { poId: string }) {
  return (
    <div className="command-center-order-detail">
      <PoOrderPrSummaryAccordion poId={poId} />
      <div className="command-center-order-detail__line-details">
        <h2 className="command-center-order-detail__section-title">Line Details</h2>
        <p className="command-center-order-detail__placeholder">Table rows can be wired to live data next.</p>
      </div>
    </div>
  )
}

export function RequisitionDetailsTabView({ prId }: { prId: string }) {
  const row = REQUISITION_ROWS.find((r) => r.id === prId)
  const lineRows = useMemo(() => (row != null ? requisitionLineRowsForPr(row) : []), [row])
  if (row == null) {
    return (
      <div className="command-center-order-detail-wrap">
        <p className="command-center-order-detail__placeholder">Requisition {prId} was not found.</p>
      </div>
    )
  }
  return (
    <section className="command-center-pr-report-section" aria-label="Requisition report">
      <div className="command-center-pr-summary-panel">
        <h2 id="cc-pr-summary-heading" className="command-center-pr-summary-panel__heading">
          PR Summary : {row.id}
        </h2>
        <div className="command-center-pr-summary-panel__row" role="group" aria-label="Requisition summary fields">
          <div className="command-center-pr-summary-panel__cell">
            <div className="command-center-pr-summary-panel__label">PR ID</div>
            <div className="command-center-pr-summary-panel__value">{row.id}</div>
          </div>
          <div className="command-center-pr-summary-panel__cell">
            <div className="command-center-pr-summary-panel__label">Preferred Vendor</div>
            <div className="command-center-pr-summary-panel__value">
              {row.vendorId} — {row.vendor}
            </div>
          </div>
          <div className="command-center-pr-summary-panel__cell">
            <div className="command-center-pr-summary-panel__label">No. of Lines</div>
            <div className="command-center-pr-summary-panel__value">{row.buyerAssignedLineCount}</div>
          </div>
          <div className="command-center-pr-summary-panel__cell">
            <div className="command-center-pr-summary-panel__label">Target Place Date</div>
            <div className="command-center-pr-summary-panel__value">{row.needBy}</div>
          </div>
          <div className="command-center-pr-summary-panel__cell">
            <div className="command-center-pr-summary-panel__label">Total Amt</div>
            <div className="command-center-pr-summary-panel__value">{row.amount}</div>
          </div>
        </div>
      </div>

      <div className="command-center-pr-line-details-panel" aria-labelledby="cc-pr-line-details-heading">
        <h2 id="cc-pr-line-details-heading" className="command-center-pr-line-details-panel__heading">
          Line details
        </h2>
        <div className="command-center-pr-line-details-panel__table-scroll">
          <Table
            headerVariant="white"
            striped
            className="command-center-data-table command-center-pr-line-details-table"
            header={PR_LINE_DETAILS_TABLE_HEADER}
            body={<PrLineDetailsTableBody rows={lineRows} />}
          />
        </div>
      </div>
    </section>
  )
}

function HomeShell() {
  const [prototypeVersion, setPrototypeVersion] = useState('v1')
  const [useCaseScenario, setUseCaseScenario] = useState('end-to-end')
  const closeThroughDelaEnabled = useCaseScenario !== 'dela-not-enabled'
  const [activeTabId, setActiveTabId] = useState<string>('closing-manager')
  const [refreshTick, setRefreshTick] = useState(0)
  const [roleFilter, setRoleFilter] = useState('accountant')
  const [assigneeOptions, setAssigneeOptions] = useState<Option[]>(BASE_CLOSING_ASSIGNEE_OPTIONS)

  const handleAddAssigneeFromSearch = useCallback((label: string): Option => {
    const trimmed = label.trim()
    let resolved!: Option
    setAssigneeOptions((prev) => {
      const hit = prev.find((o) => o.label.trim().toLowerCase() === trimmed.toLowerCase())
      if (hit) {
        resolved = hit
        return prev
      }
      resolved = { value: `assignee-${Date.now()}`, label: trimmed }
      return [...prev, resolved]
    })
    return resolved
  }, [])
  const [userFilters, setUserFilters] = useState<string[]>([CLOSING_CURRENT_USER_ID])
  const roleDropdownId = useId().replace(/:/g, '')
  const userDropdownId = useId().replace(/:/g, '')
  const themeProps = THEME_SHELL_PROPS[DEFAULT_THEME] ?? THEME_SHELL_PROPS['theme-cp']

  const closingPlanShowUser = useMemo(
    () => closingPlanShowUserColumn(userFilters),
    [userFilters],
  )

  const closingPlanSortColumns = useMemo(
    () =>
      closingPlanShowUser ? CLOSING_PLAN_SORT_COLUMNS_WITH_USER : CLOSING_PLAN_SORT_COLUMNS_BASE,
    [closingPlanShowUser],
  )

  const closingVisibleTasks = useMemo(
    () => closingTasksForFilters(userFilters),
    [userFilters],
  )

  const closingMetrics = useMemo(
    () => closingMetricsFromTasks(closingVisibleTasks),
    [closingVisibleTasks],
  )

  const closingProgressBars = useMemo(
    () => closingProgressBarsFromTasks(closingVisibleTasks),
    [closingVisibleTasks],
  )

  const closingProgressYAxisMax = useMemo(
    () => closingProgressChartYAxisMax(closingProgressBars),
    [closingProgressBars],
  )

  const commandCenterTabs = useMemo(
    () =>
      CC_MAIN_TAB_IDS.map((id) => ({
        id,
        label:
          id === 'general-ledger'
            ? 'General Ledger'
            : id === 'financial-review'
              ? 'Financial Review'
              : 'Closing Manager',
        active: activeTabId === id,
        showClose: false as const,
      })),
    [activeTabId],
  )

  const floatingNavActions = (
    <>
      <div className="floating-nav__buttons">
        <button type="button" className="floating-nav__btn floating-nav__btn--secondary">
          Full Screen
        </button>
        <button type="button" className="floating-nav__btn floating-nav__btn--secondary">
          Close Command Center
        </button>
      </div>
      <div className="floating-nav__divider" />
      <button type="button" className="floating-nav__pin" aria-label="Pin navigation">
        <Icon name="pin" size="md" className="floating-nav__pin-icon" />
      </button>
    </>
  )

  return (
    <ShellLayout
      {...themeProps}
      className="command-center-shell"
      pageHeaderTitle="Command Center"
      pageHeaderShowDefaultButtons={false}
      pageHeaderActions={
        <Dropdown
          id="cc-use-case-scenario"
          name="useCaseScenario"
          className="command-center-use-case"
          triggerClassName="btn btn--outline btn--md"
          triggerIconSize="sm"
          options={USE_CASE_SCENARIO_OPTIONS}
          value={useCaseScenario}
          onChange={setUseCaseScenario}
        />
      }
      companyName="Company name (system/environment name)"
      brandAccessory={
        <Dropdown
          id="cc-prototype-version"
          name="prototypeVersion"
          className="header__version"
          options={PROTOTYPE_VERSION_OPTIONS}
          value={prototypeVersion}
          onChange={setPrototypeVersion}
          triggerIconSize="sm"
        />
      }
      floatingNavActions={floatingNavActions}
      rightSidebarSections={COMMAND_CENTER_RIGHT_RAIL}
      rightSidebarAlign="content"
      rightSidebarTopAnchor='[aria-label="Refresh"]'
      rightShellPanelVariant="dela"
      rightShellPanelBottomAlign="content"
      rightShellPanelDelaSlot={
        prototypeVersion === 'v2' ? (
          <DelaPanelContentV2
            key={`v2-${useCaseScenario}`}
            closeThroughDelaEnabled={closeThroughDelaEnabled}
          />
        ) : (
          <DelaPanelContent
            key={`v1-${useCaseScenario}`}
            closeThroughDelaEnabled={closeThroughDelaEnabled}
          />
        )
      }
    >
      <Card primary elevated className="command-center-home">
        <div className="card__body">
          <div className="command-center-tab-row">
            <TabStrip
              tabs={commandCenterTabs}
              onTabSelected={(id: string) => {
                if ((CC_MAIN_TAB_IDS as readonly string[]).includes(id)) {
                  setActiveTabId(id)
                }
              }}
              overflowMode="none"
              className="tabstrip--command-center-tabs"
            />
            <div className="command-center-toolbar-cluster" aria-label="Closing filters">
              <Dropdown
                id={`cc-closing-role-${roleDropdownId}`}
                name="closingRole"
                triggerClassName="btn btn--outline btn--md"
                triggerIconSize="sm"
                options={CLOSING_ROLE_OPTIONS}
                value={roleFilter}
                onChange={setRoleFilter}
              />
              <Dropdown
                id={`cc-closing-user-${userDropdownId}`}
                name="closingAssignees"
                multiple
                multipleCommitMode="apply-cancel"
                panelSearchable
                panelSearchPlaceholder="Search"
                onAddSearchResult={handleAddAssigneeFromSearch}
                values={userFilters}
                onValuesChange={setUserFilters}
                allOptionValue={CLOSING_USER_FILTER_ALL}
                allUsersCheckboxLabel="All tasks"
                allOptionRowHint="all tasks"
                clearAllUsersFallbackValue={CLOSING_CURRENT_USER_ID}
                currentUserOptionValue={CLOSING_CURRENT_USER_ID}
                currentUserTriggerLabel="My tasks"
                currentUserRowHint="my tasks"
                triggerClassName="btn btn--outline btn--md"
                triggerIconSize="sm"
                options={assigneeOptions}
                placeholder="Users"
                triggerFixedWidth="156px"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                icon="arrow-path"
                ariaLabel="Refresh"
                onClick={() => setRefreshTick((t) => t + 1)}
              />
            </div>
          </div>

          {activeTabId === 'closing-manager' && (
            <>
              <section className="closing-manager-section" aria-labelledby="closing-metrics-heading">
                <h2 id="closing-metrics-heading" className="closing-manager-section__title">
                  Closing Metrics
                </h2>
                <div className="closing-metrics-row">
                  <div className="closing-metric-card">
                    <div className="closing-metric-card__label">Open Tasks</div>
                    <div className="closing-metric-card__value">{closingMetrics.openTasks}</div>
                  </div>
                  <div className="closing-metric-card">
                    <div className="closing-metric-card__label">Total Tasks</div>
                    <div className="closing-metric-card__value">{closingMetrics.totalTasks}</div>
                  </div>
                  <div className="closing-metric-card">
                    <div className="closing-metric-card__label">Percent Closed</div>
                    <div className="closing-metric-card__value">{closingMetrics.percentClosed}%</div>
                  </div>
                </div>
              </section>

              <LifecycleBarChart
                key={`${refreshTick}-${userFilters.join(',')}`}
                title="Closing Progress"
                bars={closingProgressBars}
                yAxisMax={closingProgressYAxisMax}
                className="closing-manager-progress-chart"
              />

              <section className="closing-manager-section" aria-labelledby="closing-tasks-heading">
                <h2 id="closing-tasks-heading" className="closing-manager-section__title">
                  Closing Plan Tasks
                </h2>
                <Table
                  variant="commandCenter"
                  striped
                  className="command-center-data-table closing-plan-tasks-table"
                  sortColumns={closingPlanSortColumns}
                  commandCenterToolbar={
                    <div className="closing-plan-toolbar">
                      <Button type="button" variant="outline" size="lg">
                        Collapse All
                      </Button>
                      <Button type="button" variant="outline" size="lg">
                        Expand All
                      </Button>
                    </div>
                  }
                  body={
                    <ClosingPlanTasksTableBody
                      userFilters={userFilters}
                      assigneeOptions={assigneeOptions}
                      showUserColumn={closingPlanShowUser}
                    />
                  }
                />
              </section>
            </>
          )}

          {activeTabId === 'general-ledger' && (
            <div className="command-center-tab-placeholder">
              <p className="text-secondary">
                General Ledger (placeholder). Use the Closing Manager tab for the closing dashboard.
              </p>
            </div>
          )}

          {activeTabId === 'financial-review' && (
            <div className="command-center-tab-placeholder">
              <p className="text-secondary">
                Financial Review (placeholder). Use the Closing Manager tab for the closing dashboard.
              </p>
            </div>
          )}
        </div>
      </Card>
    </ShellLayout>
  )
}

function shortBuildStampLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso.slice(0, 14)
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`
}

/** Tiny on-screen + console proof of which bundle loaded (`vite.config` `__APP_BUILD_ID__`). */
function AppBuildStamp() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.info('[Costpoint Command Center] bundle', {
      buildId: __APP_BUILD_ID__,
      mode: import.meta.env.MODE,
    })
  }, [])

  const modeTag = import.meta.env.DEV ? 'dev' : 'prod'
  const short = shortBuildStampLabel(__APP_BUILD_ID__)

  const el = (
    <div
      className="app-build-stamp"
      data-app-build-stamp
      title={`Build: ${__APP_BUILD_ID__}\nMODE: ${import.meta.env.MODE}`}
      aria-label={`Application bundle ${modeTag} ${short}`}
    >
      <span className="app-build-stamp__mode">{modeTag}</span>
      <span className="app-build-stamp__sep" aria-hidden>
        ·
      </span>
      <span className="app-build-stamp__time">{short}</span>
    </div>
  )

  if (!mounted || typeof document === 'undefined') return null
  return createPortal(el, document.body)
}

function App() {
  useEffect(() => {
    document.documentElement.classList.remove(
      'theme-cp',
      'theme-ppm',
      'theme-vp',
      'theme-maconomy',
    )
    document.documentElement.classList.add(DEFAULT_THEME)
    document.documentElement.classList.remove('dark')
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<HomeShell />} />
        <Route path="/components" element={<ComponentGalleryPage />} />
        <Route path="/components/:componentName" element={<ComponentDemoPage />} />
        <Route path="/demos/right-sidebar-panels" element={<RightSidebarPanelDemosPage />} />
      </Routes>
      <AppBuildStamp />
    </>
  )
}

export default App
