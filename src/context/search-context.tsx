"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BlockErrorBoundary } from "@/components/chat/BlockErrorBoundary";
import { trackFeature } from "@/lib/analytics/events";

// The search modal and its data subscriptions (chat history, projects, pins,
// agents) live in SearchData, loaded on first open. This provider only owns
// open/close, so opening search re-renders `useSearch()` consumers and nothing
// else, and chat or pin updates never re-render this provider.
const SearchData = dynamic(() => import("@/components/GlobalSearchModal/SearchData"), {
  ssr: false,
  loading: () => null,
});

// ── Context ───────────────────────────────────────────────────────────────────

interface SearchContextValue {
  searchOpen: boolean;
  openSearch: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  searchOpen: false,
  openSearch: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  // Mount SearchData on the first open and keep it, so the close animation and
  // its caches survive.
  const [mounted, setMounted] = useState(false);
  if (searchOpen && !mounted) setMounted(true);

  const openSearch = useCallback(() => {
    trackFeature("search");
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Cmd/Ctrl+K opens search from anywhere in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

  const value = useMemo(() => ({ searchOpen, openSearch }), [searchOpen, openSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {mounted && (
        // A search failure renders nothing rather than taking the layout down;
        // the next open tries again.
        <BlockErrorBoundary fallback={null} resetKey={searchOpen}>
          <SearchData open={searchOpen} onClose={closeSearch} />
        </BlockErrorBoundary>
      )}
    </SearchContext.Provider>
  );
}
