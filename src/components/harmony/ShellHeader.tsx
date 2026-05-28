import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Icon } from './Icon'
import { Avatar } from './Avatar'

export interface CompanyOption {
  id: string
  name: string
  color?: string
}

const PPM_COMPANIES: CompanyOption[] = [
  { id: 'project-alpha', name: 'Project Alpha', color: '#8B5CF6' },
  { id: 'project-beta', name: 'Project Beta', color: '#EC4899' },
]

export interface ShellHeaderProps {
  productName?: string
  logoSrc?: string
  companyName?: string
  showCompanyPicker?: boolean
  companyColor?: string
  companies?: CompanyOption[]
  className?: string
}

export function ShellHeader({
  productName = 'Harmony',
  logoSrc = '/logos/PPMLogo.svg',
  companyName = 'Company name',
  showCompanyPicker = true,
  companyColor,
  companies = PPM_COMPANIES,
  className = '',
}: ShellHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedName, setSelectedName] = useState(companyName)
  const [selectedColor, setSelectedColor] = useState(
    companyColor ?? companies[0]?.color
  )
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const close = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pickerOpen])

  const effectiveColor = selectedColor ?? companies[0]?.color
  const gradientStyle =
    effectiveColor
      ? {
          background: `linear-gradient(to right, ${effectiveColor}05, ${effectiveColor} 50%, ${effectiveColor}05)`,
        }
      : undefined

  return (
    <header className={clsx('header', className)}>
      <div className="header__brand">
        <Link to="/" className="header__brand-link" title="Command Center home">
          <img src={logoSrc} alt="Logo" className="header__logo" />
          <span className="header__title">{productName}</span>
        </Link>
      </div>
      <div className="header__actions">
        {showCompanyPicker && (
          <div className="company-picker" ref={pickerRef}>
            <button
              type="button"
              className="company-picker__btn"
              data-company-picker-btn
              onClick={() => setPickerOpen((o) => !o)}
            >
              <span
                className="company-picker__indicator"
                data-company-indicator
                style={
                  effectiveColor
                    ? { backgroundColor: effectiveColor }
                    : undefined
                }
              />
              <span className="company-picker__name" data-company-name>
                {selectedName}
              </span>
              <Icon
                name="chevron-down"
                size="sm"
                className="company-picker__chevron"
              />
            </button>
            <div
              className={clsx(
                'company-picker__menu',
                pickerOpen && 'company-picker__menu--open'
              )}
              data-company-picker-menu
            >
              {companies.map((company, index) => (
                <button
                  key={company.id}
                  type="button"
                  className={clsx(
                    'company-picker__option',
                    index === 0 && 'company-picker__option--selected'
                  )}
                  data-company-option
                  data-company-id={company.id}
                  onClick={() => {
                    setSelectedName(company.name)
                    setSelectedColor(company.color)
                    setPickerOpen(false)
                  }}
                >
                  <span
                    className="company-picker__option-indicator"
                    style={
                      company.color
                        ? { backgroundColor: company.color }
                        : undefined
                    }
                  />
                  <span className="company-picker__option-name">
                    {company.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {showCompanyPicker && <div className="divider" />}
        <Avatar size="sm" interactive />
      </div>
      <div
        className="header__gradient"
        data-header-gradient
        style={gradientStyle}
      />
    </header>
  )
}
