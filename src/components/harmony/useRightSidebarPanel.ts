import { useCallback, useState, type RefObject } from 'react'
import type { RightSidebarNavItem } from './RightSidebar'

export interface UseRightSidebarPanelOptions {
  shellPanelScopeRef?: RefObject<HTMLElement | null>
  rightPanelRef?: RefObject<HTMLElement | null>
  shellPanelVariant?: 'default' | 'dela'
  initialTitle?: string
  initialTitleIcon?: string
}

function resolveRightPanelElement(
  shellPanelScopeRef: RefObject<HTMLElement | null> | undefined,
  rightPanelRef: RefObject<HTMLElement | null> | undefined
): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return (
    shellPanelScopeRef?.current?.querySelector('.shell-panel--right') ??
    rightPanelRef?.current ??
    document.querySelector('.shell-panel--right')
  )
}

export interface RightSidebarItemActivateDetail {
  item: RightSidebarNavItem
  sectionIndex: number
  itemIndex: number
  itemKey: string
}

export function useRightSidebarPanel(options: UseRightSidebarPanelOptions = {}) {
  const {
    shellPanelScopeRef,
    rightPanelRef,
    shellPanelVariant = 'default',
    initialTitle = 'Panel',
    initialTitleIcon,
  } = options

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [titleIcon, setTitleIcon] = useState<string | undefined>(initialTitleIcon)
  const [useGradientHeader, setUseGradientHeader] = useState(false)
  const [isDelaAI, setIsDelaAI] = useState(false)
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null)

  const closePanel = useCallback(() => {
    setOpen(false)
    setUseGradientHeader(false)
    setIsDelaAI(false)
    setActiveItemKey(null)
    setTitle(initialTitle)
    setTitleIcon(initialTitleIcon)
  }, [initialTitle, initialTitleIcon])

  const handleItemActivate = useCallback(
    (detail: RightSidebarItemActivateDetail) => {
      const { item, itemKey } = detail
      const panelTitle = item.panelTitle ?? item.label
      const iconName = item.panelIcon ?? item.icon

      const resolved = resolveRightPanelElement(shellPanelScopeRef, rightPanelRef)
      const isDelaPanel =
        shellPanelVariant === 'dela' ||
        resolved?.getAttribute('data-dela-panel') === 'true'

      const isDelaAI =
        panelTitle === 'Dela AI' || (item.isCustom === true && Boolean(item.customSrc))
      const shouldUseGradient = Boolean(item.useGradientHeader) || isDelaAI
      const preserveDelaLayout = isDelaPanel && (isDelaAI || shouldUseGradient)

      setTitle(panelTitle)
      setUseGradientHeader(shouldUseGradient)
      setIsDelaAI(isDelaAI)
      if (!preserveDelaLayout) {
        setTitleIcon(iconName)
      } else if (isDelaAI) {
        // Dela AI has no title icon of its own; drop the previous panel's icon.
        setTitleIcon(undefined)
      }
      setOpen(true)
      setActiveItemKey(itemKey)
    },
    [shellPanelScopeRef, rightPanelRef, shellPanelVariant]
  )

  return {
    open,
    title,
    titleIcon,
    useGradientHeader,
    isDelaAI,
    activeItemKey,
    closePanel,
    handleItemActivate,
  }
}
