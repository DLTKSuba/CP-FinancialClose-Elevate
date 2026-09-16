import clsx from 'clsx'
import { useEffect, useRef } from 'react'
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
  /** Rendered beside the product name in the shell header. */
  brandAccessory?: ReactNode
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
  /** Panel body used only while a Dela AI rail item is active; falls back to rightShellPanelSlot. */
  rightShellPanelDelaSlot?: ReactNode
  /**
   * 'viewport' (default) keeps the Harmony footer-aware bottom edge.
   * 'content' ends the right panel where the main content ends.
   */
  rightShellPanelBottomAlign?: 'viewport' | 'content'
  /**
   * 'center' (default) keeps the Harmony vertically centred rail.
   * 'content' starts the rail where the main content starts.
   */
  rightSidebarAlign?: 'center' | 'content'
  /**
   * With rightSidebarAlign='content', a selector inside the main content whose vertical centre
   * the first rail item lines up with (e.g. a toolbar button). Falls back to the content top.
   */
  rightSidebarTopAnchor?: string
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
  brandAccessory,
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
  rightShellPanelDelaSlot,
  rightShellPanelBottomAlign = 'viewport',
  rightSidebarAlign = 'center',
  rightSidebarTopAnchor,
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
  const containerRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const rightRailPanel = useRightSidebarPanel({
    shellPanelScopeRef: rightShellScopeRef,
    rightPanelRef: rightShellPanelRef,
    shellPanelVariant: rightShellPanelVariant,
    initialTitle: rightShellPanelInitialTitle,
    initialTitleIcon: rightShellPanelInitialTitleIcon,
  })

  // The rail and panel are fixed to the viewport, so content edges have to be measured.
  useEffect(() => {
    const alignBottom = rightShellPanelBottomAlign === 'content'
    const alignTop = rightSidebarAlign === 'content'
    if (!alignBottom && !alignTop) return
    const container = containerRef.current
    const main = mainRef.current
    if (!container || !main) return

    const syncOffsets = () => {
      const styles = getComputedStyle(main)
      const bounds = main.getBoundingClientRect()
      if (alignBottom) {
        const paddingBottom = parseFloat(styles.paddingBottom) || 0
        const contentBottom = bounds.bottom - paddingBottom
        const offset = Math.max(0, window.innerHeight - contentBottom)
        container.style.setProperty('--shell-panel-content-bottom-offset', `${offset}px`)
      }
      if (alignTop) {
        const paddingTop = parseFloat(styles.paddingTop) || 0
        let offset = bounds.top + paddingTop
        const anchor = rightSidebarTopAnchor
          ? main.querySelector<HTMLElement>(rightSidebarTopAnchor)
          : null
        const rail = container.querySelector<HTMLElement>('.shell-layout__right-sidebar')
        const firstItem = rail?.querySelector<HTMLElement>('[data-right-sidebar-item]')
        if (anchor && rail && firstItem) {
          const anchorBounds = anchor.getBoundingClientRect()
          const railBounds = rail.getBoundingClientRect()
          const itemBounds = firstItem.getBoundingClientRect()
          // Keep the first rail item centred on the anchor, whatever padding the rail carries.
          const itemCentreFromRailTop = itemBounds.top + itemBounds.height / 2 - railBounds.top
          offset = anchorBounds.top + anchorBounds.height / 2 - itemCentreFromRailTop
        }
        container.style.setProperty('--shell-rail-content-top-offset', `${Math.max(0, offset)}px`)
      }
    }

    syncOffsets()
    const observer = new ResizeObserver(syncOffsets)
    observer.observe(main)
    window.addEventListener('resize', syncOffsets)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncOffsets)
      container.style.removeProperty('--shell-panel-content-bottom-offset')
      container.style.removeProperty('--shell-rail-content-top-offset')
    }
  }, [rightShellPanelBottomAlign, rightSidebarAlign, rightSidebarTopAnchor])

  return (
    <div
      className={clsx('shell-layout', className)}
      data-cp-variant={isCPVariant}
      data-use-theme-detection="false"
    >
      <div
        ref={containerRef}
        className="shell-layout__container"
        data-has-footer={String(effectiveHasFooter)}
        data-has-floating-nav={String(effectiveShowFloatingNav)}
        data-has-right-sidebar={String(showRightSidebar)}
        data-footer-variant={footerVariant}
        data-panel-bottom-align={rightShellPanelBottomAlign}
        data-rail-align={rightSidebarAlign}
      >
        <ShellHeader
          productName={productName}
          logoSrc={logoSrc}
          companyName={companyName}
          showCompanyPicker={showCompanyPicker}
          companyColor={companyColor}
          companies={companies}
          brandAccessory={brandAccessory}
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
              {(rightRailPanel.isDelaAI ? rightShellPanelDelaSlot : undefined) ??
                rightShellPanelSlot ?? (
                  <div style={{ padding: 'var(--space-4)' }}>
                    <p className="text-secondary" style={{ fontSize: 'var(--text-sm)' }}>
                      Contextual drawer for the right rail. Icons update the header title, gradient,
                      and icon when appropriate; Dela panels preserve layout for Dela AI / gradient
                      items.
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

        <main ref={mainRef} className="shell-layout__main">
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
