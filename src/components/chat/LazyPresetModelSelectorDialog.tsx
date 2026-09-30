"use client";

import dynamic from "next/dynamic";
import { useModelSelectorContext } from "@/context/model-selector-context";

// PresetModelSelectorDialog (and everything it imports — ModelIcon/
// ModelSelectItem, which pull in @strange-huge/icons/llm, a ~10MB/6.5MB-gzip
// module of every LLM provider's logo data) is mounted unconditionally in
// the (app) root layout, so every authenticated page's initial bundle paid
// for it whether or not that page ever opens a model picker. The dialog
// itself already rendered nothing until `isOpen` ({isOpen && (...)} in its
// own JSX), so gating the mount here — not just the render — means the
// dynamic import's chunk is only fetched the first time a user actually
// opens a model picker anywhere in the app, not on every page load.
const PresetModelSelectorDialogImpl = dynamic(
  () =>
    import("@/components/chat/PresetModelSelectorDialog").then((m) => ({
      default: m.PresetModelSelectorDialog,
    })),
  { ssr: false, loading: () => null },
);

export function LazyPresetModelSelectorDialog() {
  const { isOpen } = useModelSelectorContext();
  if (!isOpen) return null;
  return <PresetModelSelectorDialogImpl />;
}
