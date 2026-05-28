import clsx from 'clsx'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { ShellHeader } from './ShellHeader'
import type { CompanyOption } from './ShellHeader'
import { ShellFooter } from './ShellFooter'
import { FloatingNav } from './FloatingNav'
import { LeftSidebar } from './LeftSidebar'
import { RightSidebar } from './RightSidebar'
import { ShellPageHeader } from './ShellPageHeader'
import { ShellPanel } from './ShellPanel'
import { Card } from './Card'
import type { ShellFooterTab } from './ShellFooter'
import type { ShellPageHeaderButtonConfig } from './ShellPageHeader'
import type { LeftSidebarSection, LeftSidebarVariant } from './LeftSidebar'
import type { RightSidebarSection, RightSidebarVariant } from './RightSidebar'
import { useRightSidebarPanel } from './useRightSidebarPanel'
import './ShellLayout.css'

export interface ShellLayoutProps {
  productName?: string
  logoSrc?: string
  companyName?: string
  showCompanyPicker?: boolean
  companyColor?: string
  /** Company options for the header picker; when not provided, ShellHeader uses its default list. */
  companies?: CompanyOption[]
  // CP-specific props
  showFloatingNav?: boolean
  floatingNavVariant?: 'full' | 'compact'
  showExecute?: boolean
  saveDisabled?: boolean
  /** When set, replaces default FloatingNav buttons (Execute / Actions / Save). */
  floatingNavActions?: ReactNode
  leftSidebarVariant?: LeftSidebarVariant
  // Standard props
  tabs?: ShellFooterTab[]
  showMoreTabs?: boolean
  moreCount?: number
  overflowTabs?: ShellFooterTab[]
  showAddTab?: boolean
  footerVariant?: 'default' | 'compact'
  showTabOpenInNew?: boolean
  showTabClose?: boolean
  showTabOverflowMenu?: boolean
  showFooter?: boolean
  showRightSidebar?: boolean
  /** When true with showRightSidebar, renders scoped RightSidebar + ShellPanel with useRightSidebarPanel wiring. */
  showRightShellPanel?: boolean
  rightShellPanelVariant?: 'default' | 'dela'
  rightShellPanelInitialTitle?: string
  rightShellPanelInitialTitleIcon?: string
  rightShellPanelSlot?: ReactNode
  pageHeaderTitle?: string
  pageHeaderSubtitle?: string
  /** When false, hides placeholder Primary/Secondary buttons when no custom header buttons are set. */
  pageHeaderShowDefaultButtons?: boolean
  pageHeaderPrimaryButton?: ShellPageHeaderButtonConfig
  pageHeaderOutlineButton1?: ShellPageHeaderButtonConfig
  pageHeaderOutlineButton2?: ShellPageHeaderButtonConfig
  pageHeaderOutlineButton3?: ShellPageHeaderButtonConfig
  pageHeaderActions?: ReactNode
  leftSidebarSections?: LeftSidebarSection[]
  rightSidebarSections?: RightSidebarSection[]
  rightSidebarVariant?: RightSidebarVariant
  className?: string
  children?: ReactNode
}

const DEFAULT_TABS: ShellFooterTab[] = [
  { id: 'tab-1', label: 'Home', active: true },
  { id: 'tab-2', label: 'Projects', icon: 'building-office' },
  { id: 'tab-3', label: 'Reports', icon: 'Report' },
]

export function ShellLayout({
  productName,
  logoSrc,
  companyName,
  showCompanyPicker = true,
  companyColor,
  companies,
  showFloatingNav,
  floatingNavVariant,
  showExecute,
  saveDisabled,
  floatingNavActions,
  leftSidebarVariant,
  tabs = DEFAULT_TABS,
  showMoreTabs = false,
  moreCount = 0,
  overflowTabs,
  showAddTab = true,
  footerVariant = 'default',
  showTabOpenInNew = false,
  showTabClose = false,
  showTabOverflowMenu = false,
  showFooter = true,
  showRightSidebar = true,
  showRightShellPanel = true,
  rightShellPanelVariant = 'default',
  rightShellPanelInitialTitle = 'Notifications',
  rightShellPanelInitialTitleIcon = 'bell',
  rightShellPanelSlot,
  pageHeaderTitle = 'Page title',
  pageHeaderSubtitle,
  pageHeaderShowDefaultButtons = true,
  pageHeaderPrimaryButton,
  pageHeaderOutlineButton1,
  pageHeaderOutlineButton2,
  pageHeaderOutlineButton3,
  pageHeaderActions,
  leftSidebarSections,
  rightSidebarSections,
  rightSidebarVariant,
  className = '',
  children,
}: ShellLayoutProps) {
  const isCPVariant = showFloatingNav === true
  const effectiveHasFooter = showFooter
  const effectiveShowFloatingNav = showFloatingNav ?? false

  const rightShellScopeRef = useRef<HTMLDivElement>(null)
  const rightShellPanelRef = useRef<HTMLDivElement>(null)
  const rightRailPanel = useRightSidebarPanel({
    shellPanelScopeRef: rightShellScopeRef,
    rightPanelRef: rightShellPanelRef,
    shellPanelVariant: rightShellPanelVariant,
    initialTitle: rightShellPanelInitialTitle,
    initialTitleIcon: rightShellPanelInitialTitleIcon,
  })

  return (
    <div
      className={clsx('shell-layout', className)}
      data-cp-variant={isCPVariant}
      data-use-theme-detection="false"
    >
      <div
        className="shell-layout__container"
        data-has-footer={String(effectiveHasFooter)}
        data-has-floating-nav={String(effectiveShowFloatingNav)}
        data-has-right-sidebar={String(showRightSidebar)}
        data-footer-variant={footerVariant}
      >
        <ShellHeader
          productName={productName}
          logoSrc={logoSrc}
          companyName={companyName}
          showCompanyPicker={showCompanyPicker}
          companyColor={companyColor}
          companies={companies}
          className="shell-layout__header"
        />

        {effectiveShowFloatingNav && (
          <div className="shell-layout__floating-nav-wrap">
            <FloatingNav
              variant={floatingNavVariant ?? 'full'}
              showExecute={showExecute}
              saveDisabled={saveDisabled}
              actions={floatingNavActions}
            />
          </div>
        )}

        <LeftSidebar
          variant={leftSidebarVariant ?? 'ppm'}
          sections={leftSidebarSections}
          className="shell-layout__left-sidebar"
        />

        {showRightSidebar && showRightShellPanel && (
          <div
            ref={rightShellScopeRef}
            data-shell-panel-scope
            className="shell-layout__right-shell-scope"
          >
            <RightSidebar
              variant={rightSidebarVariant ?? 'ppm'}
              sections={rightSidebarSections}
              className="shell-layout__right-sidebar"
              rightPanelRef={rightShellPanelRef}
              shellPanelScopeRef={rightShellScopeRef}
              panelOpen={rightRailPanel.open}
              activeItemKey={rightRailPanel.activeItemKey}
              onItemActivate={rightRailPanel.handleItemActivate}
            />
            <ShellPanel
              ref={rightShellPanelRef}
              side="right"
              open={rightRailPanel.open}
              title={rightRailPanel.title}
              titleIcon={rightRailPanel.titleIcon}
              useGradientHeader={rightRailPanel.useGradientHeader}
              headerVariant="theme"
              width="narrow"
              variant={rightShellPanelVariant}
              showPopout
              onClose={rightRailPanel.closePanel}
              className="shell-layout__right-shell-panel"
            >
              {rightShellPanelSlot ?? (
                <div style={{ padding: 'var(--space-4)' }}>
                  <p className="text-secondary" style={{ fontSize: 'var(--text-sm)' }}>
                    Contextual drawer for the right rail. Icons update the header title, gradient, and
                    icon when appropriate; Dela panels preserve layout for Dela AI / gradient items.
                  </p>
                </div>
              )}
            </ShellPanel>
          </div>
        )}

        {showRightSidebar && !showRightShellPanel && (
          <RightSidebar
            variant={rightSidebarVariant ?? 'ppm'}
            sections={rightSidebarSections}
            className="shell-layout__right-sidebar"
          />
        )}

        <main className="shell-layout__main">
          {pageHeaderTitle != null && pageHeaderTitle !== '' && (
            <ShellPageHeader
              title={pageHeaderTitle}
              subtitle={pageHeaderSubtitle}
              showDefaultButtons={pageHeaderShowDefaultButtons}
              primaryButton={pageHeaderPrimaryButton}
              outlineButton1={pageHeaderOutlineButton1}
              outlineButton2={pageHeaderOutlineButton2}
              outlineButton3={pageHeaderOutlineButton3}
              actions={pageHeaderActions}
            />
          )}
          {children ?? (
            <Card primary elevated>
              <div className="card__body">
                <h2 className="text-xl font-semibold mb-2">
                  Page Content Area
                </h2>
                <p className="text-secondary">
                  This is where your application content lives. The shell
                  provides the structure, and you provide the content.
                </p>
              </div>
            </Card>
          )}
        </main>

        {effectiveHasFooter && (
          <ShellFooter
            tabs={tabs}
            showMore={showMoreTabs}
            moreCount={moreCount}
            overflowTabs={overflowTabs ?? []}
            showAddTab={showAddTab}
            variant={footerVariant}
            showTabOpenInNew={showTabOpenInNew}
            showTabClose={showTabClose}
            showTabOverflowMenu={showTabOverflowMenu}
            className="shell-layout__footer"
          />
        )}
      </div>
    </div>
  )
}
