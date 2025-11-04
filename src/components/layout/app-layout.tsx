import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LeftSidebar } from "./left-sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-card">
        <LeftSidebar />
        <main className="flex-1 flex">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
