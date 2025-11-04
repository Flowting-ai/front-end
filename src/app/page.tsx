
import { ChatInterface } from "@/components/chat/chat-interface";
import { Topbar } from "@/components/layout/top-bar";
import { RightSidebar } from "@/components/layout/right-sidebar";
import AppLayout from "@/components/layout/app-layout";
import { LeftSidebar } from "@/components/layout/left-sidebar";

export default function Home() {
  return (
    <AppLayout
      leftSidebar={<LeftSidebar />}
      rightSidebar={<RightSidebar />}
    >
      <div className="flex flex-col h-full flex-1">
        <Topbar />
        <ChatInterface />
      </div>
    </AppLayout>
  );
}
