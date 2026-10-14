import { useState } from 'react'
import clsx from 'clsx'
import { Badge } from './Badge'
import { Button } from './Button'
import { Icon } from './Icon'
import { Link } from './Link'
import './DelaVendorRecommendations.css'

export interface VendorCriterionScore {
  label: string
  /** Weight of the criterion in the overall score, as a percentage. */
  weight: number
  score: number
}

export interface VendorRecommendation {
  rank: number
  name: string
  overallScore: number
  status: string
  preferred: boolean
  criteria: VendorCriterionScore[]
  insight: string
}

/** Stages Dela works through while gathering vendor insights for a PO. */
export const VENDOR_INSIGHT_STEPS = [
  'Reading requisition lines',
  'Checking approved vendor list',
  'Scoring vendor performance',
  'Ranking vendors',
]

export const TOP_VENDOR_RECOMMENDATIONS: VendorRecommendation[] = [
  {
    rank: 1,
    name: 'AAA Electronics',
    overallScore: 75.25,
    status: 'Active',
    preferred: true,
    criteria: [
      { label: 'Qualification', weight: 25, score: 25 },
      { label: 'Cost', weight: 25, score: 0.25 },
      { label: 'Quality', weight: 25, score: 25 },
      { label: 'Delivery', weight: 25, score: 25 },
    ],
    insight: 'Full marks on qualification, quality and delivery. Pricing is above the other bids.',
  },
  {
    rank: 2,
    name: 'ACME Supplies',
    overallScore: 50.5,
    status: 'Active',
    preferred: false,
    criteria: [
      { label: 'Qualification', weight: 25, score: 25 },
      { label: 'Cost', weight: 25, score: 15.5 },
      { label: 'Quality', weight: 25, score: 5 },
      { label: 'Delivery', weight: 25, score: 5 },
    ],
    insight: 'Qualified with competitive pricing, but limited quality and delivery history.',
  },
  {
    rank: 3,
    name: 'Northwind Components',
    overallScore: 42.75,
    status: 'Active',
    preferred: false,
    criteria: [
      { label: 'Qualification', weight: 25, score: 12.5 },
      { label: 'Cost', weight: 25, score: 20.25 },
      { label: 'Quality', weight: 25, score: 5 },
      { label: 'Delivery', weight: 25, score: 5 },
    ],
    insight: 'Lowest cost, but only partly qualified for these items.',
  },
]

/** Criterion scores below this share of their weight are flagged as weak. */
const WEAK_CRITERION_RATIO = 0.25

const formatScore = (value: number) => value.toFixed(2)

function CriteriaBreakdown({ criteria, id }: { criteria: VendorCriterionScore[]; id: string }) {
  return (
    <dl className="dela-vendors__criteria" id={id}>
      {criteria.map((criterion) => {
        const ratio = criterion.weight > 0 ? criterion.score / criterion.weight : 0
        const weak = ratio < WEAK_CRITERION_RATIO
        return (
          <div key={criterion.label} className="dela-vendors__criterion">
            <dt>
              {criterion.label} <span className="dela-vendors__weight">({criterion.weight}%)</span>
            </dt>
            <dd>
              <span className="dela-vendors__meter" aria-hidden>
                <span
                  className={clsx(
                    'dela-vendors__meter-fill',
                    weak && 'dela-vendors__meter-fill--weak'
                  )}
                  style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                />
              </span>
              <span className={clsx('dela-vendors__criterion-score', weak && 'dela-vendors__criterion-score--weak')}>
                {formatScore(criterion.score)}
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

const requisitionNumber = (requisitionId: string | undefined) =>
  requisitionId?.match(/(\d[\d_]*)$/)?.[1] ?? '1001'

function sourcingDocumentId(prefix: 'RFQ' | 'QT', requisitionId: string | undefined, rank: number) {
  return `${prefix}-${requisitionNumber(requisitionId)}-${String(rank).padStart(2, '0')}`
}

export const poIdFor = (requisitionId: string | undefined) =>
  `PO-${requisitionNumber(requisitionId)}`

export const rfqIdFor = (requisitionId: string | undefined, rank: number) =>
  sourcingDocumentId('RFQ', requisitionId, rank)

export const quoteIdFor = (requisitionId: string | undefined, rank: number) =>
  sourcingDocumentId('QT', requisitionId, rank)

export interface DelaVendorRecommendationsProps {
  vendors?: VendorRecommendation[]
  requisitionId?: string
  /** Vendor the RFQ went to; disables sending to the others once set. */
  rfqSentTo?: string | null
  onSendRfq?: (vendor: VendorRecommendation, rfqId: string) => void
}

export function DelaVendorRecommendations({
  vendors = TOP_VENDOR_RECOMMENDATIONS,
  requisitionId,
  rfqSentTo = null,
  onSendRfq,
}: DelaVendorRecommendationsProps) {
  const sentRank = vendors.find((v) => v.name === rfqSentTo)?.rank
  const [expandedRanks, setExpandedRanks] = useState<number[]>([])
  const rfqSent = sentRank != null

  const toggleExpanded = (rank: number) =>
    setExpandedRanks((prev) =>
      prev.includes(rank) ? prev.filter((r) => r !== rank) : [...prev, rank]
    )

  return (
    <section className="dela-vendors" aria-labelledby="dela-vendors-title">
      <h4 id="dela-vendors-title" className="dela-vendors__title">
        Top {vendors.length} vendors for this PO
      </h4>
      <p className="dela-vendors__basis">
        Ranked by overall score out of 100. Qualification, cost, quality and delivery each count
        for 25%.
      </p>

      <ol className="dela-vendors__list" aria-label="Recommended vendors">
        {vendors.map((vendor) => {
          const isSent = vendor.rank === sentRank
          const isExpanded = expandedRanks.includes(vendor.rank)
          const detailId = `dela-vendor-detail-${vendor.rank}`
          const rfqId = rfqIdFor(requisitionId, vendor.rank)
          return (
            <li
              key={vendor.rank}
              className={clsx('dela-vendors__card', isSent && 'dela-vendors__card--selected')}
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailId}
                className="dela-vendors__card-main"
                onClick={() => toggleExpanded(vendor.rank)}
              >
                <span className="dela-vendors__rank" aria-label={`Rank ${vendor.rank}`}>
                  {vendor.rank}
                </span>
                <span className="dela-vendors__identity">
                  <span className="dela-vendors__name">{vendor.name}</span>
                  <span className="dela-vendors__tags">
                    {vendor.rank === 1 && (
                      <Badge variant="success" size="small">
                        Recommended
                      </Badge>
                    )}
                    {vendor.preferred && (
                      <Badge variant="primary" size="small">
                        Preferred vendor
                      </Badge>
                    )}
                    <Badge variant="default" size="small">
                      {vendor.status}
                    </Badge>
                  </span>
                </span>
                <span className="dela-vendors__score" aria-label={`Overall score ${formatScore(vendor.overallScore)} out of 100`}>
                  <span className="dela-vendors__score-value">{formatScore(vendor.overallScore)}</span>
                  <span className="dela-vendors__score-max">/100</span>
                </span>
                <Icon
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size="sm"
                  className="dela-vendors__chevron"
                />
              </button>

              <span className="dela-vendors__overall-meter" aria-hidden>
                <span
                  className="dela-vendors__overall-meter-fill"
                  style={{ width: `${vendor.overallScore}%` }}
                />
              </span>

              {isExpanded && (
                <div className="dela-vendors__detail" id={detailId}>
                  <p className="dela-vendors__insight">{vendor.insight}</p>
                  <CriteriaBreakdown
                    criteria={vendor.criteria}
                    id={`dela-vendor-breakdown-${vendor.rank}`}
                  />
                </div>
              )}

              <div className="dela-vendors__actions">
                <span className="dela-vendors__rfq-link">
                  <Icon name="document" size="xs" className="dela-vendors__rfq-icon" />
                  <Link href="#" size="small" onClick={(event) => event.preventDefault()}>
                    View RFQ {rfqId}
                  </Link>
                </span>
                {isSent ? (
                  <Badge variant="info" size="small">
                    RFQ sent
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon="paper-airplane"
                    disabled={rfqSent}
                    ariaLabel={`Send RFQ ${rfqId} to ${vendor.name}`}
                    onClick={() => onSendRfq?.(vendor, rfqId)}
                  >
                    Send RFQ
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
