import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Opportunity, OpportunityCategory } from '@/lib/home/mock-data'
import { formatOpportunityValue } from '@/lib/home/format'
import { cn } from '@/lib/utils'
import styles from './Home.module.css'

const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  inventory: 'Inventory',
  fulfilment: 'Fulfilment',
  growth: 'Growth',
}

export interface OpportunityItemProps {
  opportunity: Opportunity
  /** Where the row leads — e.g. a new chat seeded with the finding. */
  href: string
}

/** A finding as one link row: category, title, detail and the headline number. */
export function OpportunityItem({ opportunity: o, href }: OpportunityItemProps) {
  const value = formatOpportunityValue(o.value, o.valueFormat)
  return (
    <Link href={href} className={styles.opportunity}>
      <div>
        <span className={cn(styles.chip, o.category === 'growth' && styles.chipGrowth)}>{CATEGORY_LABELS[o.category]}</span>
        <h3 className={styles.opportunityTitle}>{o.title}</h3>
        <p className={styles.opportunityDescription}>{o.description}</p>
      </div>
      <div className={styles.opportunityValue}>
        <strong>{value}</strong>
        <span>{o.valueCaption}</span>
      </div>
      <ArrowRight className={styles.opportunityArrow} size={16} strokeWidth={1.75} aria-hidden />
    </Link>
  )
}

export interface OpportunitiesListProps {
  opportunities: Opportunity[]
  hrefFor: (opportunity: Opportunity) => string
}

export function OpportunitiesList({ opportunities, hrefFor }: OpportunitiesListProps) {
  const count = opportunities.length
  return (
    <section className={styles.opportunities} aria-labelledby="home-opportunities">
      <div className={styles.sectionHead}>
        <h2 id="home-opportunities" className={styles.sectionTitle}>Opportunities</h2>
        <span className={styles.sectionMeta}>{count} {count === 1 ? 'finding' : 'findings'}</span>
      </div>
      {count === 0 ? (
        <p className={styles.empty}>Nothing needs your attention right now.</p>
      ) : (
        <ul className={styles.opportunityList}>
          {opportunities.map(o => <li key={o.id}><OpportunityItem opportunity={o} href={hrefFor(o)} /></li>)}
        </ul>
      )}
    </section>
  )
}
