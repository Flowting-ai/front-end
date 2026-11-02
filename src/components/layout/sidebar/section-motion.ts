import type { UseChatHistoryResult } from "@/hooks/use-chat-history";

// -- Section show/hide animation - matches Sidebar design system ---------------

export const sectionHeightVariants = {
  open: {
    height: "auto" as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
};

// -- Item stagger animation - same three-layer pattern as Sidebar's Default*Items --
// Layer 2 - stagger orchestrator: delays children until after the height
// animation completes so items never appear mid-clip.
export const sectionStaggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
};

// Layer 3 - per-item: fade + drift
export const sectionItemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: "easeIn"  as const } },
};

// -- Shared section props ------------------------------------------------------

export interface SectionProps {
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  chatHistory: UseChatHistoryResult;
}
