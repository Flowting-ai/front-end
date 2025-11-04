import AppLayout from "@/components/layout/app-layout";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Topbar } from "@/components/layout/top-bar";
import { RightSidebar } from "@/components/layout/right-sidebar";

export default function Home() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <Topbar />
        <ChatInterface />
      </div>
      <RightSidebar />
    </AppLayout>
  );
}
