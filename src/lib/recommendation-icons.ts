import {
  AnalyticsOneIcon,
  AtomOneIcon,
  AuctionIcon,
  CalendarFoldIcon,
  LinkSixIcon,
  QuillWriteOneIcon,
  SearchOneIcon,
  SourceCodeIcon,
  StickyNoteTwoIcon,
  TargetTwoIcon,
} from '@strange-huge/icons'
import type { CardIcon } from '@/lib/api/recommendations'

// ── Starter-card icons ───────────────────────────────────────────────────────
// The backend names a kind of work; the look of it is ours. Every CardIcon the
// API can return has an entry here, so a card always renders.

export const RECOMMENDATION_ICONS: Record<
  CardIcon,
  { Icon: typeof SearchOneIcon; color: string }
> = {
  research:  { Icon: SearchOneIcon,     color: 'var(--blue-500)'   },
  write:     { Icon: QuillWriteOneIcon, color: '#141B34'           },
  plan:      { Icon: AtomOneIcon,       color: 'var(--purple-500)' },
  compare:   { Icon: AuctionIcon,       color: 'var(--green-500)'  },
  schedule:  { Icon: CalendarFoldIcon,  color: 'var(--yellow-500)' },
  analyze:   { Icon: AnalyticsOneIcon,  color: 'var(--blue-500)'   },
  summarize: { Icon: StickyNoteTwoIcon, color: '#141B34'           },
  code:      { Icon: SourceCodeIcon,    color: 'var(--purple-500)' },
  automate:  { Icon: TargetTwoIcon,     color: 'var(--green-500)'  },
  connect:   { Icon: LinkSixIcon,       color: 'var(--blue-500)'   },
}
