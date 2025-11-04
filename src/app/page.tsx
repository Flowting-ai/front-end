import { ChatInterface } from "@/components/chat/chat-interface";
import { Topbar } from "@/components/layout/top-bar";
import { RightSidebar } from "@/components/layout/right-sidebar";

export default function Home() {
  return (
    <>
      <div className="flex flex-col h-full flex-1">
        <Topbar />
        <ChatInterface />
      </div>
      <RightSidebar />
    </>
  );
}
