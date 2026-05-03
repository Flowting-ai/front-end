import { AppLayout } from "@/components/layout/AppLayout";
import { ChatHistoryProvider } from "@/context/chat-history-context";
import { PinboardProvider } from "@/context/pinboard-context";
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
        <ModelSelectorProvider>
          <AppLayout>{children}</AppLayout>
          <PresetModelSelectorDialog />
        </ModelSelectorProvider>
      </PinboardProvider>
    </ChatHistoryProvider>
  );
}
