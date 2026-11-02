'use client'

import { useState } from 'react'
import { AskSouvenir, BestSellerCard, HomeHeader, MetricStrip, OpportunitiesList } from '@/components/Home'
import styles from '@/components/Home/Home.module.css'
import { buildChatPromptUrl } from '@/lib/home/chat-link'
import { getHomeData, type DateRange, type Opportunity } from '@/lib/home/mock-data'

const hrefForOpportunity = (o: Opportunity) => buildChatPromptUrl(o.prompt)

/**
 * Container for Home: owns the period and reads the data for it. Mock data for now —
 * getHomeData(range) is the seam a React Query hook with the same HomeData shape replaces.
 */
export function HomeScreen() {
  const [range, setRange] = useState<DateRange>('30d')
  const data = getHomeData(range)
  return (
    <div className={styles.page}>
      <HomeHeader
        storeName={data.storeName}
        storeLive={data.storeLive}
        range={range}
        onRangeChange={setRange}
        watchingCount={data.watchingCount}
      />
      <MetricStrip metrics={data.metrics} />
      <div className={styles.feature} style={data.bestSeller ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {data.bestSeller && <BestSellerCard product={data.bestSeller} />}
        <OpportunitiesList opportunities={data.opportunities} hrefFor={hrefForOpportunity} />
      </div>
      <AskSouvenir suggestions={data.suggestions} />
    </div>
  )
}
