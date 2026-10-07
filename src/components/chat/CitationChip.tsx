"use client";

import { Tooltip } from '@/components/Tooltip'
import { m } from "framer-motion";
import { SourceCitation, SourceList as SourceListUI } from "@/components/SourceCitation";
import type { SourceItem } from "@/components/SourceCitation";
import type { WebCitation } from "@/types/chat";
import { listedSources } from "@/lib/citations";

// -- CitationChip � inline numbered chip backed by SourceCitation hover card ----

function webCitationToSourceItem(citation: WebCitation, n: number): SourceItem {
  return {
    id:    citation.url ?? n,
    title: citation.title || citation.domain || `Source ${n}`,
    url:   citation.url,
    meta:  citation.domain || undefined,
  }
}

export function CitationChip({ n, citation }: { n: number; citation?: WebCitation }) {
  if (!citation) {
    return (
      <Tooltip content="Source unavailable"><span
        role="note"
        aria-label={`Source ${n} unavailable`}
        data-missing-citation="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          verticalAlign: 'text-bottom', width: 18, height: 18, borderRadius: '999px',
          backgroundColor: 'transparent', fontFamily: 'var(--font-body)',
          fontWeight: 600, fontSize: 10, lineHeight: 1, color: 'var(--neutral-600)',
          marginLeft: 2, flexShrink: 0, border: '1px dashed var(--neutral-300)',
        }}
      >
        ?
      </span></Tooltip>
    )
  }
  return (
    <SourceCitation
      index={n}
      source={webCitationToSourceItem(citation, n)}
      onOpen={(s) => { if (s.url) window.open(s.url, '_blank', 'noopener,noreferrer') }}
    />
  )
}


// -- SourceList � footnote list of web citations backed by SourceListUI ---------

// `citations` is indexed by citation number (citation N at index N - 1) and may
// have holes for numbers the answer skipped; each card keeps its own N.
export function SourceList({ citations }: { citations: WebCitation[] }) {
  const sources = listedSources(citations).map(({ n, citation }) => webCitationToSourceItem(citation, n))
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
    >
      <SourceListUI sources={sources} />
    </m.div>
  )
}
