import { AnalyticsPageSkeleton, AnalyticsScroll } from './_components/AnalyticsParts'

/** Route-level placeholder: the same skeleton the page shows while org data loads. */
export default function AnalyticsLoading() {
  return <AnalyticsScroll><AnalyticsPageSkeleton /></AnalyticsScroll>
}
