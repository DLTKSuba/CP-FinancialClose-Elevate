import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { Icon } from './Icon'
import { Input } from './Input'
import './ProjectFilterControl.css'

export interface ProjectRow {
  id: string
  name: string
}

/** Sample projects aligned with the Command Center “Select Projects” reference. */
export const DEFAULT_LIFECYCLE_PROJECTS: ProjectRow[] = [
  { id: 'PRJ-001', name: 'Enterprise Resource Planning' },
  { id: 'PRJ-002', name: 'Customer Relationship Management' },
  { id: 'PRJ-003', name: 'Supply Chain Optimization' },
  { id: 'PRJ-004', name: 'Digital Transformation Initiative' },
  { id: 'PRJ-005', name: 'Cloud Infrastructure Upgrade' },
  { id: 'PRJ-006', name: 'Mobile Application Rollout' },
]

function formatTriggerLabel(
  selectedIds: string[],
  projects: ProjectRow[],
  allLabel: string
): string {
  if (projects.length === 0) return allLabel
  if (selectedIds.length === projects.length) return allLabel
  if (selectedIds.length === 0) return 'No projects selected'
  if (selectedIds.length === 1) {
    const p = projects.find((x) => x.id === selectedIds[0])
    return p?.id ?? allLabel
  }
  return `${selectedIds.length} projects`
}

export interface ProjectFilterControlProps {
  projects: ProjectRow[]
  /** Selected project IDs (controlled). */
  value: string[]
  onChange: (selectedIds: string[]) => void
  /** Label when every project is selected. */
  allLabel?: string
  className?: string
}

export function ProjectFilterControl({
  projects,
  value,
  onChange,
  allLabel = 'All Projects',
  className = '',
}: ProjectFilterControlProps) {
  const baseId = useId().replace(/:/g, '-')
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Set<string>>(() => new Set(value))
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 400 })

  const triggerLabel = useMemo(
    () => formatTriggerLabel(value, projects, allLabel),
    [value, projects, allLabel]
  )

  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          q === '' ||
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      ),
    [projects, q]
  )

  useEffect(() => {
    if (open) {
      setDraft(new Set(value))
      setSearch('')
    }
  }, [open, value])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const handleCancel = useCallback(() => {
    setDraft(new Set(value))
    setSearch('')
    close()
  }, [value, close])

  const handleApply = useCallback(() => {
    onChange(Array.from(draft))
    setSearch('')
    close()
  }, [draft, onChange, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, handleCancel])

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const margin = 8
    const width = Math.min(400, Math.max(300, window.innerWidth - margin * 2))
    let left = r.right - width
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
    const top = r.bottom + margin
    setPopoverPos({ top, left, width })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePopoverPosition()
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
    }
  }, [open, updatePopoverPosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (containerRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      handleCancel()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, handleCancel])

  const toggleId = (id: string, checked: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const titleId = `${baseId}-title`

  return (
    <div
      ref={containerRef}
      className={clsx('project-filter-control', open && 'project-filter-control--open', className)}
    >
      <button
        ref={triggerRef}
        type="button"
        className="project-filter-control__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${baseId}-panel` : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="funnel" size="sm" className="project-filter-control__funnel" />
        <span className="project-filter-control__trigger-value">{triggerLabel}</span>
        <Icon name="chevron-down" size="sm" className="project-filter-control__chevron" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={`${baseId}-panel`}
            className="project-filter-control__popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              zIndex: 400,
            }}
          >
            <div className="project-filter-control__popover-header">
              <h2 id={titleId} className="project-filter-control__title">
                Select Projects
              </h2>
              <span
                className="project-filter-control__align-check"
                aria-label="Design aligned with reference"
                title="Layout matches reference"
              >
                <Icon name="check" size="sm" />
              </span>
            </div>

            <div className="project-filter-control__search-wrap">
              <Input
                type="search"
                name={`project-search-${baseId}`}
                placeholder="Search by ID or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon="magnifying-glass"
                className="project-filter-control__search-input"
                aria-label="Search projects by ID or name"
              />
            </div>

            <div className="project-filter-control__list" role="list">
              {filtered.length === 0 ? (
                <p className="project-filter-control__empty">No matching projects.</p>
              ) : (
                filtered.map((p) => {
                  const checked = draft.has(p.id)
                  const slug = p.id.replace(/[^a-zA-Z0-9]/g, '-')
                  const cbId = `${baseId}-cb-${slug}`
                  const rowLabelId = `${baseId}-lbl-${slug}`
                  return (
                    <div key={p.id} className="project-filter-control__row" role="listitem">
                      <Checkbox
                        id={cbId}
                        checked={checked}
                        onChange={(e) => toggleId(p.id, e.target.checked)}
                        aria-labelledby={rowLabelId}
                      />
                      <label htmlFor={cbId} className="project-filter-control__row-label">
                        <span id={rowLabelId} className="project-filter-control__row-label-inner">
                          <span className="project-filter-control__project-id">{p.id}</span>
                          <span className="project-filter-control__project-name">{p.name}</span>
                        </span>
                      </label>
                    </div>
                  )
                })
              )}
            </div>

            <div className="project-filter-control__footer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="project-filter-control__footer-btn"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="project-filter-control__footer-btn"
                onClick={handleApply}
              >
                Apply
              </Button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
