import { AppLayout } from "@/components/layout/AppLayout";
import { ChatHistoryProvider } from "@/context/chat-history-context";
import { PinboardProvider } from "@/context/pinboard-context";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatHistoryProvider>
      <PinboardProvider>
        <AppLayout>{children}</AppLayout>
      </PinboardProvider>
    </ChatHistoryProvider>
  );
}
