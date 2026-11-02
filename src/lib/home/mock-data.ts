// Mock data for the Home page. The shapes below are the contract the page renders from; swapping
// getHomeData for a React Query hook (same return type) is all a real backend needs.

import type { MetricFormat, OpportunityValueFormat } from './format'

export type Channel = 'shopify' | 'tiktok' | 'instagram'

export type DateRange = '7d' | '30d' | '90d'

export const DATE_RANGE_OPTIONS: ReadonlyArray<{ value: DateRange; label: string }> = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export interface HomeMetric {
  id: string
  label: string
  value: number
  format: MetricFormat
  /** Change against the previous period, in percent units (3.3 = +3.3%). */
  delta: number
  channels: Channel[]
}

export interface BestSeller {
  name: string
  /** "Sand · Stoneware · 320 ml" — already joined for display. */
  subtitle: string
  revenue: number
  channel: Channel
  /** Public path or URL of the product photo. Without one the card is a plain panel. */
  imageSrc?: string
  imageAlt?: string
}

export type OpportunityCategory = 'inventory' | 'fulfilment' | 'growth'

export interface Opportunity {
  id: string
  category: OpportunityCategory
  title: string
  description: string
  value: number
  valueFormat: OpportunityValueFormat
  valueCaption: string
  /** The question handed to a new chat when the row is opened. */
  prompt: string
}

export interface HomeData {
  storeName: string
  storeLive: boolean
  watchingCount: number
  metrics: HomeMetric[]
  bestSeller: BestSeller | null
  opportunities: Opportunity[]
  suggestions: string[]
}

const ALL_CHANNELS: Channel[] = ['shopify', 'tiktok', 'instagram']

const BEST_SELLER_BASE: Omit<BestSeller, 'revenue'> = {
  name: 'Everyday mug',
  subtitle: 'Sand · Stoneware · 320 ml',
  channel: 'shopify',
}

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'restock-everyday-mug',
    category: 'inventory',
    title: 'Keep the Everyday mug in stock',
    description: '15 days of stock · 20-day supplier lead',
    value: 5,
    valueFormat: 'days',
    valueCaption: 'potential gap',
    prompt: 'The Everyday mug has 15 days of stock and a 20-day supplier lead. How do I avoid the 5-day gap?',
  },
  {
    id: 'late-orders',
    category: 'fulfilment',
    title: 'Get 23 orders moving',
    description: 'Review late orders and prepare proactive updates.',
    value: 8_900,
    valueFormat: 'currency',
    valueCaption: 'in orders',
    prompt: 'Show me the 23 late orders and draft proactive updates for those customers.',
  },
  {
    id: 'monthly-growth',
    category: 'growth',
    title: 'Build on this month’s growth',
    description: 'See how more visits lifted revenue.',
    value: 3.3,
    valueFormat: 'signedPercent',
    valueCaption: 'this month',
    prompt: 'Revenue is up 3.3% this month. How did more visits lift it, and how do I build on it?',
  },
]

const SUGGESTIONS = ['Why did revenue rise?', 'Watch the next delivery', 'Review the restock plan']

const METRICS: Record<DateRange, HomeMetric[]> = {
  '7d': [
    { id: 'revenue',    label: 'Revenue',           value: 452_300, format: 'currency', delta: 1.2,  channels: ALL_CHANNELS },
    { id: 'orders',     label: 'Orders',            value: 1_164,   format: 'count',    delta: 0.8,  channels: ALL_CHANNELS },
    { id: 'conversion', label: 'Visitors who buy',  value: 0.51,    format: 'percent',  delta: -0.4, channels: ['shopify'] },
    { id: 'aov',        label: 'Avg. order',        value: 388.57,  format: 'currency', delta: 0.4,  channels: ALL_CHANNELS },
  ],
  '30d': [
    { id: 'revenue',    label: 'Revenue',           value: 1_885_200, format: 'currency', delta: 3.3,  channels: ALL_CHANNELS },
    { id: 'orders',     label: 'Orders',            value: 4_893,     format: 'count',    delta: 3.5,  channels: ALL_CHANNELS },
    { id: 'conversion', label: 'Visitors who buy',  value: 0.53,      format: 'percent',  delta: -0.6, channels: ['shopify'] },
    { id: 'aov',        label: 'Avg. order',        value: 385.27,    format: 'currency', delta: -0.2, channels: ALL_CHANNELS },
  ],
  '90d': [
    { id: 'revenue',    label: 'Revenue',           value: 5_412_800, format: 'currency', delta: 6.1,  channels: ALL_CHANNELS },
    { id: 'orders',     label: 'Orders',            value: 14_207,    format: 'count',    delta: 5.4,  channels: ALL_CHANNELS },
    { id: 'conversion', label: 'Visitors who buy',  value: 0.55,      format: 'percent',  delta: 0.3,  channels: ['shopify'] },
    { id: 'aov',        label: 'Avg. order',        value: 380.99,    format: 'currency', delta: -1.1, channels: ALL_CHANNELS },
  ],
}

const BEST_SELLER_REVENUE: Record<DateRange, number> = { '7d': 2_100, '30d': 8_400, '90d': 24_600 }

export function getHomeData(range: DateRange): HomeData {
  return {
    storeName: 'forma',
    storeLive: true,
    watchingCount: 3,
    metrics: METRICS[range],
    bestSeller: { ...BEST_SELLER_BASE, revenue: BEST_SELLER_REVENUE[range] },
    opportunities: OPPORTUNITIES,
    suggestions: SUGGESTIONS,
  }
}
