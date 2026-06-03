import type { ChangeEvent, CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useState, useId, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import clsx from 'clsx'
import { Icon } from './Icon'
import { Label } from './Label'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import {
  bindKanbanCpMenuScrollSync,
  clearKanbanCpFixedMenu,
  syncKanbanCpFixedMenu,
} from '../../utils/kanban-cp-dropdown-position'
import './Dropdown.css'

export interface Option {
  value: string
  label: string
  disabled?: boolean
}

export type DropdownMultipleCommitMode = 'apply-cancel'

export interface DropdownProps {
  options: Option[]
  value?: string
  placeholder?: string
  name?: string
  id?: string
  disabled?: boolean
  className?: string
  label?: string
  labelVariant?: 'inline' | 'stacked'
  labelFor?: string
  /** Custom trigger content (replaces default trigger with value + chevron) */
  trigger?: ReactNode
  /**
   * Extra classes on the trigger button (e.g. `btn btn--outline btn--md` to match Harmony
   * outline buttons with a chevron from the default trigger content).
   */
  triggerClassName?: string
  /** Chevron size for the default trigger (`sm` with `btn--md` mirrors `Button` icon sizing). */
  triggerIconSize?: 'xs' | 'sm' | 'md' | 'lg'
  /** Custom content per option for first 10 options (option-0 through option-9) */
  optionSlots?: (ReactNode | null)[]
  onChange?: (value: string) => void
  /**
   * Multi-select mode: use `values` + `onValuesChange` instead of `value` + `onChange`.
   * Without `multipleCommitMode`, the menu stays open and each row applies immediately.
   */
  multiple?: boolean
  values?: string[]
  defaultValues?: string[]
  onValuesChange?: (values: string[]) => void
  /**
   * When set, a single sentinel in `values` means “everyone” (e.g. `__all__`).
   * With `multipleCommitMode: 'apply-cancel'`, do not include this value in `options`;
   * an “All” row **checkbox** is shown above the per-user checkboxes.
   */
  allOptionValue?: string
  /** Label for the synthetic “All” row checkbox when using `multipleCommitMode`. */
  allUsersCheckboxLabel?: string
  /** Trigger label when only `allOptionValue` is selected (e.g. `100 selected`). Falls back to `allUsersCheckboxLabel`. */
  allOptionTriggerLabel?: string
  /** Secondary hint beside the “All” row in the apply-cancel panel (e.g. `all tasks`). */
  allOptionRowHint?: string
  /**
   * With `multipleCommitMode: 'apply-cancel'`, when “All users” is unchecked, selection
   * falls back to this user id (must match an option `value`).
   */
  clearAllUsersFallbackValue?: string
  /** Option `value` for the signed-in user (e.g. `joe`). */
  currentUserOptionValue?: string
  /** Trigger label when only `currentUserOptionValue` is selected (e.g. `My tasks`). */
  currentUserTriggerLabel?: string
  /** Secondary hint beside the current-user row in the apply-cancel panel (e.g. `my tasks`). */
  currentUserRowHint?: string
  /**
   * Checkboxes + draft selection; **Apply** commits, **Cancel** or outside click discards.
   * Requires `multiple`, `allOptionValue`, and `options` listing only assignable users
   * (not the all-users sentinel).
   */
  multipleCommitMode?: DropdownMultipleCommitMode
  /** Search field at top of apply-cancel panel; filters `options` by label/value. */
  panelSearchable?: boolean
  /** Placeholder for the panel search field. */
  panelSearchPlaceholder?: string
  /**
   * When set with `panelSearchable`, shows **Add** when the query is non-empty and does not
   * exactly match an existing option label (case-insensitive). Return the new or existing
   * option; parent should append new options to state.
   */
  onAddSearchResult?: (label: string) => Option
  /**
   * When set (e.g. `16rem`), the trigger keeps that width so the label can change
   * (e.g. “2 users selected”) without resizing the control.
   */
  triggerFixedWidth?: string
}

export function Dropdown({
  options,
  value,
  placeholder = 'Select an option',
  name,
  id,
  disabled = false,
  className = '',
  label,
  labelVariant,
  labelFor,
  trigger: triggerSlot,
  triggerClassName,
  triggerIconSize = 'sm',
  optionSlots,
  onChange,
  multiple = false,
  values,
  defaultValues,
  onValuesChange,
  allOptionValue,
  allUsersCheckboxLabel = 'All users',
  allOptionTriggerLabel,
  allOptionRowHint,
  clearAllUsersFallbackValue,
  currentUserOptionValue,
  currentUserTriggerLabel,
  currentUserRowHint,
  multipleCommitMode,
  panelSearchable = false,
  panelSearchPlaceholder = 'Search users',
  onAddSearchResult,
  triggerFixedWidth,
}: DropdownProps) {
  const generatedId = useId().replace(/:/g, '-')
  const dropdownId = id || `dropdown-${generatedId}`
  const [isOpen, setIsOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(value ?? '')
  const [internalMultiValues, setInternalMultiValues] = useState<string[]>(() => defaultValues ?? [])
  const [draftValues, setDraftValues] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const controlled = value !== undefined
  const controlledMulti = multiple && values !== undefined
  const currentValue = controlled ? value : internalValue
  const currentMultiValues = controlledMulti ? (values as string[]) : internalMultiValues
  const selectedOption = !multiple && options.find((opt) => opt.value === currentValue)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  const useApplyPanel = Boolean(multiple && multipleCommitMode === 'apply-cancel')

  const filteredPanelOptions = useMemo(() => {
    if (!useApplyPanel || !panelSearchable) return options
    const q = searchQuery.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    )
  }, [options, panelSearchable, searchQuery, useApplyPanel])

  const { panelCurrentUserOption, panelOtherOptions } = useMemo(() => {
    if (!useApplyPanel || !currentUserOptionValue) {
      const sorted = [...filteredPanelOptions].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      )
      return { panelCurrentUserOption: null, panelOtherOptions: sorted }
    }
    const current = filteredPanelOptions.find((o) => o.value === currentUserOptionValue) ?? null
    const others = filteredPanelOptions
      .filter((o) => o.value !== currentUserOptionValue)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return { panelCurrentUserOption: current, panelOtherOptions: others }
  }, [filteredPanelOptions, useApplyPanel, currentUserOptionValue])

  const renderPanelAssigneeRow = (option: Option) => {
    const isCurrentUser =
      currentUserOptionValue != null && option.value === currentUserOptionValue
    return (
      <div
        key={option.value}
        className={clsx(
          'dropdown__menu-row',
          isCurrentUser && currentUserRowHint && 'dropdown__menu-row--with-hint'
        )}
      >
        <Checkbox
          id={`${dropdownId}-user-${option.value}`}
          checked={draftValues.includes(option.value)}
          disabled={option.disabled}
          onChange={(e) => handleUserCheckboxChange(option.value, e)}
          label={option.label}
        />
        {isCurrentUser && currentUserRowHint ? (
          <span className="dropdown__menu-row-hint">{currentUserRowHint}</span>
        ) : null}
      </div>
    )
  }

  const canAddFromSearch = Boolean(
    useApplyPanel &&
      panelSearchable &&
      onAddSearchResult &&
      searchQuery.trim() &&
      !options.some((o) => o.label.trim().toLowerCase() === searchQuery.trim().toLowerCase())
  )

  useEffect(() => {
    if (!isOpen) setSearchQuery('')
  }, [isOpen])

  useLayoutEffect(() => {
    if (!useApplyPanel) {
      wasOpenRef.current = isOpen
      return
    }
    if (isOpen && !wasOpenRef.current) {
      setDraftValues([...currentMultiValues])
    }
    wasOpenRef.current = isOpen
  }, [isOpen, useApplyPanel, currentMultiValues])

  const multiTriggerLabel = (() => {
    if (!multiple) return ''
    const v = currentMultiValues
    if (allOptionValue && v.length === 1 && v[0] === allOptionValue) {
      return allOptionTriggerLabel ?? allUsersCheckboxLabel
    }
    const selectedIds = allOptionValue ? v.filter((id) => id !== allOptionValue) : [...v]
    if (selectedIds.length === 0) return placeholder
    const n = selectedIds.length
    if (n === 1) {
      const onlyId = selectedIds[0]
      if (
        currentUserOptionValue &&
        currentUserTriggerLabel &&
        onlyId === currentUserOptionValue
      ) {
        return currentUserTriggerLabel
      }
      return 'Task selected (1)'
    }
    return `Task selected (${n})`
  })()

  const setMultiValues = (next: string[]) => {
    if (!controlledMulti) setInternalMultiValues(next)
    onValuesChange?.(next)
  }

  const isMultiOptionSelected = (option: Option) => {
    const v = option.value
    if (allOptionValue && v === allOptionValue) {
      return currentMultiValues.length === 1 && currentMultiValues[0] === allOptionValue
    }
    return currentMultiValues.includes(v)
  }

  const allDraftChecked = Boolean(
    allOptionValue && draftValues.length === 1 && draftValues[0] === allOptionValue
  )

  const handleAllUsersCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!allOptionValue) return
    if (e.target.checked) {
      setDraftValues([allOptionValue])
      return
    }
    const fb = clearAllUsersFallbackValue ?? options[0]?.value
    setDraftValues(fb ? [fb] : [])
  }

  const handleUserCheckboxChange = (userId: string, e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    let next = [...draftValues]
    if (allOptionValue && next.length === 1 && next[0] === allOptionValue) {
      next = []
    }
    if (checked) {
      if (!next.includes(userId)) next.push(userId)
    } else {
      next = next.filter((x) => x !== userId)
    }
    if (allOptionValue && next.length === 0) {
      next = [allOptionValue]
    } else if (!allOptionValue && next.length === 0 && options[0]) {
      next = [options[0].value]
    }
    setDraftValues(next)
  }

  const handleApplyClick = () => {
    setMultiValues([...draftValues])
    setIsOpen(false)
  }

  const handleCancelClick = () => {
    setIsOpen(false)
  }

  const handleAddFromSearch = () => {
    if (!onAddSearchResult || !canAddFromSearch) return
    const label = searchQuery.trim()
    const newOpt = onAddSearchResult(label)
    setDraftValues((prev) => {
      let next = [...prev]
      if (allOptionValue && next.length === 1 && next[0] === allOptionValue) {
        next = []
      }
      if (!next.includes(newOpt.value)) next.push(newOpt.value)
      if (allOptionValue && next.length === 0) {
        next = [allOptionValue]
      }
      return next
    })
    setSearchQuery('')
  }

  const handlePanelSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canAddFromSearch) {
      e.preventDefault()
      handleAddFromSearch()
    }
  }

  useEffect(() => {
    bindKanbanCpMenuScrollSync()
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    const menu = menuRef.current
    if (!isOpen || !container || !menu) return

    const trigger = container.querySelector('.dropdown__trigger')
    if (!(trigger instanceof HTMLElement)) return
    if (!container.closest('.kanban-card-cp')) return

    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        syncKanbanCpFixedMenu(trigger, menu)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      if (container.closest('.kanban-card-cp')) clearKanbanCpFixedMenu(menu)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node
      const container = containerRef.current
      const menu = menuRef.current
      if (!container) return
      const inDropdown = container.contains(t)
      const inMenu = menu?.contains(t) ?? false
      if (!inDropdown && !inMenu) setIsOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isOpen])

  const handleTriggerClick = () => {
    if (disabled) return
    setIsOpen((prev) => !prev)
  }

  const handleOptionClick = (option: Option) => {
    if (option.disabled) return
    if (multiple) {
      if (useApplyPanel) return
      const v = option.value
      if (allOptionValue && v === allOptionValue) {
        setMultiValues([allOptionValue])
        return
      }
      let next = [...currentMultiValues]
      if (allOptionValue && next.includes(allOptionValue)) {
        next = next.filter((x) => x !== allOptionValue)
      }
      if (next.includes(v)) {
        next = next.filter((x) => x !== v)
      } else {
        next.push(v)
      }
      if (allOptionValue && next.length === 0) {
        next = [allOptionValue]
      }
      setMultiValues(next)
      return
    }
    if (!controlled) setInternalValue(option.value)
    onChange?.(option.value)
    setIsOpen(false)
  }

  const finalLabelVariant = labelVariant
  const wrapperClasses = clsx(
    'dropdown-wrapper',
    label && finalLabelVariant && `dropdown-wrapper--${finalLabelVariant}`
  )
  const classes = clsx('dropdown', className)
  const labelClass =
    finalLabelVariant === 'inline' || !finalLabelVariant ? 'dropdown-wrapper__label' : ''

  const triggerFixedStyle: CSSProperties | undefined =
    triggerFixedWidth != null && triggerFixedWidth !== ''
      ? {
          width: triggerFixedWidth,
          minWidth: triggerFixedWidth,
          maxWidth: triggerFixedWidth,
          boxSizing: 'border-box',
        }
      : undefined

  const triggerContent = triggerSlot ?? (
    <>
      <span className="dropdown__value">
        {multiple ? multiTriggerLabel : selectedOption ? selectedOption.label : placeholder}
      </span>
      <Icon name="chevron-down" className="dropdown__chevron" size={triggerIconSize} />
    </>
  )

  const menuPanel = useApplyPanel ? (
    <div
      ref={menuRef}
      className="dropdown__menu dropdown__menu--checkbox-panel"
      role="group"
      aria-label="Select users"
    >
      {panelSearchable ? (
        <div className="dropdown__menu-search">
          <Input
            type="search"
            id={`${dropdownId}-panel-search`}
            className="dropdown__menu-search-input"
            placeholder={panelSearchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handlePanelSearchKeyDown}
            aria-label={panelSearchPlaceholder}
            autoComplete="off"
          />
        </div>
      ) : null}
      <div className="dropdown__menu-body">
        {panelCurrentUserOption ? renderPanelAssigneeRow(panelCurrentUserOption) : null}
        {panelCurrentUserOption && (allOptionValue || panelOtherOptions.length > 0) ? (
          <div className="dropdown__menu-divider" role="separator" aria-hidden />
        ) : null}
        {allOptionValue ? (
          <div
            className={clsx(
              'dropdown__menu-row',
              allOptionRowHint && 'dropdown__menu-row--with-hint'
            )}
          >
            <Checkbox
              id={`${dropdownId}-all-users`}
              checked={allDraftChecked}
              onChange={handleAllUsersCheckboxChange}
              label={allUsersCheckboxLabel}
            />
            {allOptionRowHint ? (
              <span className="dropdown__menu-row-hint">{allOptionRowHint}</span>
            ) : null}
          </div>
        ) : null}
        {panelOtherOptions.map((option) => renderPanelAssigneeRow(option))}
      </div>
      {canAddFromSearch ? (
        <div className="dropdown__menu-add-row">
          <Button type="button" variant="outline" size="md" onClick={handleAddFromSearch}>
            Add &ldquo;{searchQuery.trim()}&rdquo;
          </Button>
        </div>
      ) : null}
      <div className="dropdown__menu-footer">
        <Button type="button" variant="outline" size="md" onClick={handleCancelClick}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="md" onClick={handleApplyClick}>
          Apply
        </Button>
      </div>
    </div>
  ) : (
    <div
      ref={menuRef}
      className="dropdown__menu"
      role="listbox"
      aria-multiselectable={multiple ? true : undefined}
    >
      {options.map((option, optIndex) => {
        const customContent = optionSlots && optIndex < optionSlots.length ? optionSlots[optIndex] : null
        const isSelected = multiple ? isMultiOptionSelected(option) : option.value === currentValue
        return (
          <button
            key={option.value}
            type="button"
            className={clsx(
              'dropdown__item',
              multiple && 'dropdown__item--multi',
              isSelected && 'is-selected',
              option.disabled && 'dropdown__item--disabled'
            )}
            data-value={option.value}
            disabled={option.disabled}
            role="option"
            aria-selected={isSelected}
            onClick={() => handleOptionClick(option)}
          >
            {multiple ? (
              <>
                <span className="dropdown__item-check" aria-hidden>
                  {isSelected ? <Icon name="check" size="sm" /> : null}
                </span>
                <span className="dropdown__item-label">{customContent != null ? customContent : option.label}</span>
              </>
            ) : customContent != null ? (
              customContent
            ) : (
              option.label
            )}
          </button>
        )
      })}
    </div>
  )

  const dropdownBlock = (
    <div
      ref={containerRef}
      className={clsx(classes, isOpen && 'is-open')}
      data-dropdown
      id={dropdownId}
    >
      <button
        type="button"
        className={clsx(
          'dropdown__trigger',
          triggerClassName,
          triggerFixedStyle && 'dropdown__trigger--fixed-width'
        )}
        style={triggerFixedStyle}
        disabled={disabled}
        aria-haspopup={useApplyPanel ? 'dialog' : 'listbox'}
        aria-expanded={isOpen}
        onClick={handleTriggerClick}
      >
        {triggerContent}
      </button>
      {menuPanel}
      {multiple && name ? (
        <input type="hidden" name={name} value={currentMultiValues.join(',')} />
      ) : name ? (
        <input type="hidden" name={name} value={currentValue || ''} />
      ) : null}
    </div>
  )

  if (label) {
    return (
      <div className={wrapperClasses}>
        <Label htmlFor={labelFor || dropdownId} className={labelClass}>
          {label}
        </Label>
        {dropdownBlock}
      </div>
    )
  }

  return dropdownBlock
}
