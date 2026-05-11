import { AppLayout } from "@/components/layout/AppLayout";
import { ChatHistoryProvider } from "@/context/chat-history-context";
import { PinboardProvider } from "@/context/pinboard-context";
import { HighlightProvider } from "@/context/highlight-context";
import { CompareProvider } from "@/context/compare-context";
import { ModelSelectorProvider } from "@/context/model-selector-context";
import { PresetModelSelectorDialog } from "@/components/chat/PresetModelSelectorDialog";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatHistoryProvider>
      <PinboardProvider>
        <HighlightProvider>
          <CompareProvider>
            <ModelSelectorProvider>
              <AppLayout>{children}</AppLayout>
              <PresetModelSelectorDialog />
            </ModelSelectorProvider>
          </CompareProvider>
        </HighlightProvider>
      </PinboardProvider>
    </ChatHistoryProvider>
  );
}
