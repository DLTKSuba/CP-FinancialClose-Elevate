import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Routes, Route } from 'react-router-dom'
import { ShellLayout } from './components/harmony/ShellLayout'
import type { ShellLayoutProps } from './components/harmony/ShellLayout'
import type { RightSidebarSection } from './components/harmony/RightSidebar'
import { Card } from './components/harmony/Card'
import { Button } from './components/harmony/Button'
import { TabStrip } from './components/harmony/TabStrip'
import { Table } from './components/harmony/Table'
import { LifecycleBarChart } from './components/harmony/LifecycleBarChart'
import type { LifecycleBarChartBar } from './components/harmony/LifecycleBarChart'
import { Link } from './components/harmony/Link'
import { ListMenu } from './components/harmony/ListMenu'
import {
  ProjectFilterControl,
  DEFAULT_LIFECYCLE_PROJECTS,
} from './components/harmony/ProjectFilterControl'
import { Icon } from './components/harmony/Icon'
import { DelaPanelContent } from './components/harmony/DelaPanelContent'
import type { LeftSidebarSection } from './components/harmony/LeftSidebar'
import { ComponentGalleryPage } from './pages/ComponentGalleryPage'
import { ComponentDemoPage } from './pages/ComponentDemoPage'
import { RightSidebarPanelDemosPage } from './pages/RightSidebarPanelDemosPage'

/** Default product theme for the designer preview (change via document.documentElement.classList if needed). */
const DEFAULT_THEME = 'theme-cp'

/** Costpoint left rail: favorites group, then module group (Command Center active). */
const COSTPOINT_LEFT_RAIL: LeftSidebarSection[] = [
  {
    items: [
      { icon: 'home', label: 'Home' },
      { icon: 'squares-plus', label: 'Applications' },
      { icon: 'star', label: 'Favorites' },
      { icon: 'view-columns', label: 'Dashboards' },
    ],
  },
  {
    items: [
      { icon: 'magnifying-glass', label: 'Search' },
      { icon: 'rectangle-group', label: 'Command Center', active: true },
      { icon: 'calculator', label: 'Accounting' },
      { icon: 'related', label: 'Related' },
      { icon: 'chart-bar', label: 'Analytics' },
      { icon: 'building-office', label: 'Organizations' },
      { icon: 'cube', label: 'Materials' },
      { icon: 'clock', label: 'Time' },
      { icon: 'users', label: 'People' },
      { icon: 'document-chart-bar', label: 'Reports' },
      { icon: 'cog-6-tooth', label: 'Settings' },
    ],
  },
]

/**
 * Per-theme ShellLayout prop defaults.
 * When DEFAULT_THEME changes, HomeShell automatically picks up the correct
 * footer visibility, floating nav, sidebar variant, product name, and logo.
 */
const THEME_SHELL_PROPS: Record<string, Partial<ShellLayoutProps>> = {
  'theme-cp': {
    productName: 'Costpoint',
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

/** Command Center primary tabs (Buyer persona: Requisitions + Purchase Orders). */
const CC_MAIN_TABS = [
  { id: 'requisitions', label: 'Requisitions' },
  { id: 'purchase-orders', label: 'Purchase Orders' },
] as const

const CC_MAIN_TAB_IDS: readonly string[] = CC_MAIN_TABS.map((t) => t.id)

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

const REQ_STATUS_STAGE_LABELS = [
  'Pending',
  'Rejected',
  'In Approval',
  'Pending PO Creation',
] as const

const REQUISITION_AI_ACTIONS = ['Create PO', 'Suggest Vendor', 'Create Quote'] as const
type RequisitionAiAction = (typeof REQUISITION_AI_ACTIONS)[number]

const REQUISITIONERS = [
  { name: 'Jamie Chen', email: 'jamie.chen@contoso.com', org: 'HQ — Procurement' },
  { name: 'Sam Lee', email: 'sam.lee@contoso.com', org: 'Region NA — Ops' },
  { name: 'Jordan Smith', email: 'jordan.smith@contoso.com', org: 'HQ — Finance' },
  { name: 'Priya Nair', email: 'priya.nair@contoso.com', org: 'EMEA — Supply' },
  { name: 'Morgan Chen', email: 'morgan.chen@contoso.com', org: 'IT — Infrastructure' },
] as const

/** Stage index follows `REQUISITION_CHART_BARS` order (0 Pending … 3 Pending PO Creation). */
const REQUISITION_ROW_SEED: ReadonlyArray<
  [id: string, vendor: string, amount: string, stage: number, overdue: string]
> = [
  ['PR_0617_1', '', '5,326,650.00', 3, '9/10'],
  ['PR-0000167', '', '1,000.00', 3, '0/1'],
  ['PR-0000170', '', '3,763.60', 3, '0/1'],
  ['PR-0000184', 'AAA Electronics', '1,053.00', 3, '0/1'],
  ['PR-0000185', 'AAA Electronics', '1,053.00', 3, '0/1'],
  ['PR-0000186', 'AAA Electronics', '1,053.00', 3, '0/1'],
  ['PR-0000188', 'AAA Electronics', '2,106.00', 3, '0/2'],
  ['PR-0000191', 'Blue Horizon Corp', '18,420.00', 3, '1/4'],
  ['PR-0000193', 'Summit Enterprises', '7,560.25', 3, '0/3'],
  ['PR-0000195', 'TechNova Systems', '12,980.00', 3, '2/5'],
  ['PR-0000197', 'Apex Logistics', '4,215.75', 3, '0/2'],
  ['PR-0000199', 'Global Tech Solutions', '26,300.00', 3, '1/6'],
  ['PR-0000201', 'Ironclad Industries', '9,875.40', 3, '0/1'],
  ['PR-0000203', 'Crystal Dynamics', '3,150.00', 3, '0/2'],
  ['PR-0000205', 'Elite Services Group', '15,640.90', 3, '1/3'],
  ['PR-0000207', 'AAA Electronics', '1,053.00', 3, '0/1'],
  ['PR-0000210', 'Summit Enterprises', '6,480.00', 0, '1/3'],
  ['PR-0000211', '', '2,250.00', 0, '0/1'],
  ['PR-0000212', 'TechNova Systems', '11,325.50', 0, '2/4'],
  ['PR-0000213', 'Blue Horizon Corp', '850.00', 0, '0/1'],
  ['PR-0000214', 'Apex Logistics', '5,940.10', 0, '1/2'],
  ['PR-0000215', 'Global Tech Solutions', '33,780.00', 0, '3/7'],
  ['PR-0000216', 'Ironclad Industries', '4,402.65', 0, '0/2'],
  ['PR-0000217', 'Crystal Dynamics', '1,975.00', 0, '0/1'],
  ['PR-0000218', 'Elite Services Group', '8,615.30', 0, '1/5'],
  ['PR-0000219', 'AAA Electronics', '1,053.00', 0, '0/1'],
  ['PR-0000220', 'Summit Enterprises', '14,210.00', 0, '2/6'],
  ['PR-0000221', 'TechNova Systems', '3,490.00', 1, '1/2'],
  ['PR-0000222', 'Apex Logistics', '7,125.80', 1, '1/1'],
]

const REQUISITION_ROWS: RequisitionRow[] = REQUISITION_ROW_SEED.map(
  ([id, vendor, amount, stage, overdue], i) => {
    const frac = parseOverdueFraction(overdue)
    const late = frac?.late ?? 0
    const requisitioner = REQUISITIONERS[i % REQUISITIONERS.length]
    const lateItemsStageCounts: [number, number, number, number] = [0, 0, 0, 0]
    lateItemsStageCounts[stage] = late
    return {
      id,
      vendorId: vendor === '' ? '' : `VND-${900100 + i}`,
      vendor,
      amount,
      statusLabel: REQ_STATUS_STAGE_LABELS[stage],
      stageIndices: [stage],
      overdue,
      overdueUrgent: late > 0,
      requestedBy: requisitioner.name,
      organization: requisitioner.org,
      createdDate: 'Sep 15, 2026',
      needBy: 'Oct 30, 2026',
      bannerMessage: '',
      buyerAssignedLineCount: frac?.total ?? 1,
      lateItemsStageCounts,
      requisitionerName: requisitioner.name,
      requisitionerEmail: requisitioner.email,
    }
  },
)

function requisitionLineRowsForPr(row: RequisitionRow): RequisitionLineRow[] {
  const preferredVendor = row.vendor === '' ? '' : `${row.vendorId} — ${row.vendor}`
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
      status: statusEmpty ? '' : n === 1 ? 'In Approval' : 'Buyer Review',
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

/** PO lifecycle tones without Pending Inspection and Awaiting Payment. */
const REQ_LIFECYCLE_COLORS = {
  pendingSubmittal: '#ffa800',
  rejected: '#dc3545',
  pendingApproval: '#2c5f8a',
  pendingPoCreation: '#3d6bf5',
} as const

export const REQUISITION_CHART_BARS: LifecycleBarChartBar[] = [
  {
    id: 'pending-submittal',
    label: REQ_STATUS_STAGE_LABELS[0],
    value: 11,
    color: REQ_LIFECYCLE_COLORS.pendingSubmittal,
    description:
      'PR has been assigned to the Buyer and in Pending status',
  },
  {
    id: 'rejected',
    label: REQ_STATUS_STAGE_LABELS[1],
    value: 2,
    color: REQ_LIFECYCLE_COLORS.rejected,
    description: 'PR has been assigned to the Buyer and in Rejected status',
  },
  {
    id: 'pending-approval',
    label: REQ_STATUS_STAGE_LABELS[2],
    value: 0,
    color: REQ_LIFECYCLE_COLORS.pendingApproval,
    description:
      'PR has been assigned to the Buyer and In Approval',
  },
  {
    id: 'pending-po-creation',
    label: REQ_STATUS_STAGE_LABELS[3],
    value: 16,
    color: REQ_LIFECYCLE_COLORS.pendingPoCreation,
    description:
      'PR has been assigned to the Buyer and Approved',
  },
]

const PO_CHART_BARS: LifecycleBarChartBar[] = [
  { id: 'po-pending-approval', label: 'Pending Approval', value: 168, color: '#ffa800' },
  { id: 'po-pending-receipt', label: 'Pending Receipt', value: 166, color: '#dc3545' },
  { id: 'po-pending-inspection', label: 'Pending Inspection', value: 40, color: '#ff4f7b' },
  { id: 'po-awaiting-inv', label: 'Awaiting Invoice', value: 29, color: '#2c5f8a' },
  { id: 'po-pending-inv-approval', label: 'Pending Inv Approval', value: 54, color: '#3d6bf5' },
  { id: 'po-awaiting-payment', label: 'Awaiting Payment', value: 39, color: '#8a8a8a' },
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
      {commandCenterHeaderTh('Overdue Lines', 'right')}
      <th className="text-left" scope="col">
        Action
      </th>
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

function RequisitionActionCell({
  row,
  menuOpen,
  onToggleMenu,
  onAction,
}: {
  row: RequisitionRow
  menuOpen: boolean
  onToggleMenu: () => void
  onAction: (action: RequisitionAiAction, row: RequisitionRow) => void
}) {
  const [primaryAction, ...moreActions] = REQUISITION_AI_ACTIONS
  const actionsRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    if (!menuOpen || actionsRef.current == null) {
      setMenuPosition(null)
      return
    }
    const bounds = actionsRef.current.getBoundingClientRect()
    setMenuPosition({ top: bounds.bottom + 4, right: window.innerWidth - bounds.right })
  }, [menuOpen])

  return (
    <td
      className="command-center-row-actions-cell"
      data-cc-ignore
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="command-center-row-actions" ref={actionsRef}>
        <Button
          type="button"
          variant="primary"
          size="xs"
          className="command-center-row-actions__primary"
          ariaLabel={`${primaryAction} for ${row.id} (AI processed)`}
          onClick={() => onAction(primaryAction, row)}
        >
          <img src="/Stars.svg" alt="" className="command-center-ai-sparkle" />
          {primaryAction}
        </Button>
        <button
          type="button"
          className="command-center-row-actions__toggle"
          aria-label={`More AI actions for ${row.id}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <Icon name={menuOpen ? 'chevron-up' : 'chevron-down'} size="xs" />
        </button>
        {menuOpen && menuPosition != null && (
          <div className="command-center-row-actions__menu-layer" style={menuPosition}>
            <ListMenu
              variant="no-borders"
              items={moreActions.map((label) => ({
                label,
                isCustom: true,
                customSrc: '/Stars.svg',
              }))}
              onItemClick={(_item, index) => onAction(moreActions[index], row)}
            />
          </div>
        )}
      </div>
    </td>
  )
}

export function RequisitionTableBody({
  rows,
  selectedId,
  onSelectRow,
  onAction,
  lifecycleChartFilterStageIndices = null,
}: {
  rows: RequisitionRow[]
  selectedId: string | null
  onSelectRow: (id: string) => void
  onAction: (action: RequisitionAiAction, row: RequisitionRow) => void
  /** When non-empty (bar chart filter), status column shows one marker per selected stage. */
  lifecycleChartFilterStageIndices?: readonly number[] | null
}) {
  const [menuRowId, setMenuRowId] = useState<string | null>(null)

  useEffect(() => {
    if (menuRowId == null) return
    const close = (event: globalThis.MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.command-center-row-actions')) setMenuRowId(null)
    }
    const closeOnScroll = () => setMenuRowId(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [menuRowId])

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
          <td
            className="text-right"
            style={row.overdueUrgent ? { color: 'var(--color-error)' } : undefined}
          >
            {row.overdue}
          </td>
          <RequisitionActionCell
            row={row}
            menuOpen={menuRowId === row.id}
            onToggleMenu={() => setMenuRowId((prev) => (prev === row.id ? null : row.id))}
            onAction={(action, actionRow) => {
              setMenuRowId(null)
              onAction(action, actionRow)
            }}
          />
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

/** Stage indices follow `PO_CHART_BARS` order (0 Pending Approval … 5 Awaiting Payment). */
const PO_TABLE_ROW_SEED: ReadonlyArray<
  [id: string, type: string, vendor: string, amount: string, stages: readonly number[], overdue: string]
> = [
  ['PO-1039', 'Blanket PO', 'Blue Horizon Corp', '839030.96', [5, 2, 0], '3/7'],
  ['PO-1083', 'Blanket PO', 'Elite Services Group', '563747.10', [3, 1], '3/8'],
  ['PO-1091', 'Blanket PO', 'Ironclad Industries', '203678.31', [5, 1, 2], '3/7'],
  ['PO-1095', 'Blanket PO', 'Elite Services Group', '508999.40', [3, 2], '3/8'],
  ['PO-1004', 'Standard PO', 'Summit Enterprises', '163595.70', [0], '2/8'],
  ['PO-1022', 'Sub Contract', 'TechNova Systems', '296306.50', [2, 1], '2/5'],
  ['PO-1013', 'Contract', 'Apex Logistics', '768436.99', [4, 0, 1], '2/7'],
  ['PO-1019', 'Blanket PO', 'Ironclad Industries', '855876.66', [4, 3, 5], '2/7'],
  ['PO-1028', 'Standard PO', 'Summit Enterprises', '241069.39', [0], '2/5'],
  ['PO-1052', 'Standard PO', 'Summit Enterprises', '119112.27', [1], '2/7'],
  ['PO-1060', 'Standard PO', 'Global Tech Solutions', '737734.98', [5, 0, 2], '2/6'],
  ['PO-1084', 'Standard PO', 'Global Tech Solutions', '579477.67', [5, 2, 4], '2/7'],
  ['PO-1069', 'Contract', 'Crystal Dynamics', '370136.17', [0], '2/6'],
  ['PO-1094', 'Sub Contract', 'TechNova Systems', '456192.45', [2, 4], '2/6'],
]

export const PO_TABLE_ROWS: PoTableRowData[] = PO_TABLE_ROW_SEED.map(
  ([id, type, vendor, amount, stages, overdue]) => ({
    id,
    release: id,
    type,
    vendor,
    amount,
    statusLabel: stages.map((i) => PO_CHART_BARS[i]?.label ?? `Stage ${i}`).join(', '),
    stageIndices: stages,
    overdueLines: overdue,
    overdueUrgent: true,
  }),
)

export const PO_TABLE_HEADER = (
  <thead>
    <tr>
      {commandCenterHeaderTh('PO ID')}
      {commandCenterHeaderTh('Release')}
      {commandCenterHeaderTh('Type')}
      {commandCenterHeaderTh('Vendor Name')}
      {commandCenterHeaderTh('Total Amt', 'right')}
      {commandCenterHeaderTh('Status')}
      {commandCenterHeaderTh('Overdue Lines')}
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
          <td style={row.overdueUrgent ? { color: 'var(--color-error)' } : undefined}>
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
              {row.vendor === '' ? '\u00A0' : `${row.vendorId} — ${row.vendor}`}
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

const ALL_LIFECYCLE_PROJECT_IDS = DEFAULT_LIFECYCLE_PROJECTS.map((p) => p.id)

function toggleListValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function stageIndicesForBarIds(bars: LifecycleBarChartBar[], barIds: readonly string[]): number[] {
  return bars.flatMap((bar, i) => (barIds.includes(bar.id) ? [i] : []))
}

/** Rows that sit in any of the selected lifecycle stages (all rows when no stage is selected). */
function rowsMatchingStages<T extends { stageIndices: readonly number[] }>(
  rows: readonly T[],
  stages: readonly number[],
): T[] {
  if (stages.length === 0) return [...rows]
  return rows.filter((row) => row.stageIndices.some((i) => stages.includes(i)))
}

function HomeShell() {
  const [activeTabId, setActiveTabId] = useState<string>('requisitions')
  const [delaPrompt, setDelaPrompt] = useState<{ id: number; text: string } | null>(null)
  const [openDelaRequest, setOpenDelaRequest] = useState(0)
  const [detailTabs, setDetailTabs] = useState<{ id: string; label: string }[]>([])
  const [refreshTick, setRefreshTick] = useState(0)
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null)
  const [reqChartFilter, setReqChartFilter] = useState<string[]>([])
  const [poChartFilter, setPoChartFilter] = useState<string[]>([])
  const [reqProjects, setReqProjects] = useState<string[]>(ALL_LIFECYCLE_PROJECT_IDS)
  const [poProjects, setPoProjects] = useState<string[]>(ALL_LIFECYCLE_PROJECT_IDS)
  const themeProps = THEME_SHELL_PROPS[DEFAULT_THEME] ?? THEME_SHELL_PROPS['theme-cp']

  const reqFilterStages = useMemo(
    () => stageIndicesForBarIds(REQUISITION_CHART_BARS, reqChartFilter),
    [reqChartFilter],
  )
  const poFilterStages = useMemo(
    () => stageIndicesForBarIds(PO_CHART_BARS, poChartFilter),
    [poChartFilter],
  )
  const visibleReqRows = useMemo(
    () => rowsMatchingStages(REQUISITION_ROWS, reqFilterStages),
    [reqFilterStages],
  )
  const visiblePoRows = useMemo(
    () => rowsMatchingStages(PO_TABLE_ROWS, poFilterStages),
    [poFilterStages],
  )
  const selectedPr = visibleReqRows.find((r) => r.id === selectedPrId) ?? null

  const openDetailTab = (id: string, label: string) => {
    setDetailTabs((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { id, label }]))
    setActiveTabId(id)
  }

  const closeDetailTab = (id: string) => {
    setDetailTabs((prev) => prev.filter((t) => t.id !== id))
    if (activeTabId === id) {
      setActiveTabId(prIdFromDetailTabId(id) != null ? 'requisitions' : 'purchase-orders')
    }
  }

  const commandCenterTabs = useMemo(
    () => [
      ...CC_MAIN_TABS.map((t) => ({
        id: t.id,
        label: t.label,
        active: activeTabId === t.id,
        showClose: false as const,
      })),
      ...detailTabs.map((t) => ({
        id: t.id,
        label: t.label,
        active: activeTabId === t.id,
        showClose: true as const,
      })),
    ],
    [activeTabId, detailTabs],
  )

  const activePoDetailId = poIdFromDetailTabId(activeTabId)
  const activePrDetailId = prIdFromDetailTabId(activeTabId)

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
      companyName="Company name (system/environment name)"
      leftSidebarSections={COSTPOINT_LEFT_RAIL}
      floatingNavActions={floatingNavActions}
      rightSidebarSections={COMMAND_CENTER_RIGHT_RAIL}
      rightSidebarAlign="content"
      rightSidebarTopAnchor='[aria-label="Refresh"]'
      rightShellPanelVariant="dela"
      rightShellPanelBottomAlign="content"
      rightShellPanelOpenDelaRequest={openDelaRequest}
      rightShellPanelDelaSlot={
        <DelaPanelContent
          closeThroughDelaEnabled
          missingDefaultJob={false}
          externalPrompt={delaPrompt}
          onExternalPromptConsumed={() => setDelaPrompt(null)}
        />
      }
    >
      <Card primary elevated className="command-center-home">
        <div className="card__body">
          <div className="command-center-tab-row">
            <TabStrip
              tabs={commandCenterTabs}
              onTabSelected={(id: string) => {
                if (CC_MAIN_TAB_IDS.includes(id) || detailTabs.some((t) => t.id === id)) {
                  setActiveTabId(id)
                }
              }}
              onCloseTab={closeDetailTab}
              overflowMode="none"
              className="tabstrip--command-center-tabs"
            />
            <div className="command-center-toolbar-cluster">
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

          {activeTabId === 'requisitions' && (
            <LifecycleBarChart
              key={`req-${refreshTick}`}
              title="Requisition Lifecycle"
              headerActions={
                <ProjectFilterControl
                  projects={DEFAULT_LIFECYCLE_PROJECTS}
                  value={reqProjects}
                  onChange={setReqProjects}
                />
              }
              bars={REQUISITION_CHART_BARS}
              yAxisMax={20}
              selectedBarIds={reqChartFilter}
              onBarToggle={(id) => setReqChartFilter((prev) => toggleListValue(prev, id))}
              tableWrapperClassName="command-center-table-detail-anchor"
            >
              <div className="command-center-table-detail-stack">
                <Table
                  headerVariant="white"
                  striped
                  className="command-center-data-table"
                  header={REQUISITION_TABLE_HEADER}
                  body={
                    <RequisitionTableBody
                      rows={visibleReqRows}
                      selectedId={selectedPr?.id ?? null}
                      onSelectRow={(id) => setSelectedPrId((prev) => (prev === id ? null : id))}
                      onAction={(action, row) => {
                        if (action !== 'Create PO') return
                        setDelaPrompt({ id: Date.now(), text: `Create PO for ${row.id}` })
                        setOpenDelaRequest((n) => n + 1)
                      }}
                      lifecycleChartFilterStageIndices={reqFilterStages}
                    />
                  }
                />
              </div>
              {selectedPr != null && (
                <RequisitionSidePanel
                  row={selectedPr}
                  onClose={() => setSelectedPrId(null)}
                  onOpenRequisitionReportTab={(prId) => openDetailTab(prDetailTabId(prId), prId)}
                />
              )}
            </LifecycleBarChart>
          )}

          {activeTabId === 'purchase-orders' && (
            <LifecycleBarChart
              key={`po-${refreshTick}`}
              title="PO Lifecycle"
              headerActions={
                <ProjectFilterControl
                  projects={DEFAULT_LIFECYCLE_PROJECTS}
                  value={poProjects}
                  onChange={setPoProjects}
                />
              }
              bars={PO_CHART_BARS}
              yAxisMax={200}
              selectedBarIds={poChartFilter}
              onBarToggle={(id) => setPoChartFilter((prev) => toggleListValue(prev, id))}
            >
              <Table
                headerVariant="white"
                striped
                className="command-center-data-table"
                header={PO_TABLE_HEADER}
                body={
                  <PoPurchaseOrdersTableBody
                    rows={visiblePoRows}
                    onOpenOrder={(poId) => openDetailTab(poDetailTabId(poId), poId)}
                    lifecycleChartFilterStageIndices={poFilterStages}
                  />
                }
              />
            </LifecycleBarChart>
          )}

          {activePoDetailId != null && <PoOrderDetailView poId={activePoDetailId} />}
          {activePrDetailId != null && <RequisitionDetailsTabView prId={activePrDetailId} />}
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
