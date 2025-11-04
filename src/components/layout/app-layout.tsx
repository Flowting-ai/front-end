import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LeftSidebar } from "./left-sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
      <div className="flex min-h-screen bg-card">
        <SidebarProvider>
          <LeftSidebar />
          <div className="fixed top-4 left-4 z-20 md:hidden">
              <SidebarTrigger />
          </div>
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </SidebarProvider>
      </div>
  );
}
