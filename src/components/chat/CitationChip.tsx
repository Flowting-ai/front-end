"use client";

import { m } from "framer-motion";
import { SourceCitation, SourceList as SourceListUI } from "@/components/SourceCitation";
import type { SourceItem } from "@/components/SourceCitation";
import type { WebCitation } from "@/types/chat";

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
      <span
        role="note"
        aria-label={`Source ${n} unavailable`}
        title="Source unavailable"
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
      </span>
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

export function SourceList({ citations }: { citations: WebCitation[] }) {
  const sources = citations.map((c, i) => webCitationToSourceItem(c, i + 1))
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
