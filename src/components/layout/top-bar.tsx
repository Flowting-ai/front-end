
"use client";

import { Button } from "../ui/button";
import { WandSparkles, BarChart2 } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { CreatePersonaDialog } from "../personas/create-persona-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

export function Topbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const tabs = [
    { name: "Chat Board", href: "/", icon: WandSparkles },
    { name: "AI Automation", href: "/dashboard", icon: WandSparkles },
  ];

  return (
    <header className="flex items-center justify-between p-2 border-b h-[69px] bg-card shrink-0 z-20">
      <div className="flex items-center gap-4">
        {isMobile ? children : (
         <Link href="/" className="flex items-center gap-2 px-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                      <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M2 7L12 12M22 7L12 12M12 22V12M17 4.5L7 9.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
              <h1 className="text-lg font-semibold">Flowting</h1>
          </Link>
        )}
          <nav className={cn("items-center gap-2", isMobile ? "hidden" : "flex")}>
            {tabs.map((tab) => (
              <Button
                key={tab.name}
                variant="ghost"
                asChild
                className={cn(
                    "font-semibold rounded-[25px]",
                    pathname === tab.href ? "bg-accent text-accent-foreground" : ""
                )}
              >
                <Link href={tab.href}>
                  <tab.icon className="mr-2 h-4 w-4" />
                  {tab.name}
                </Link>
              </Button>
            ))}
        </nav>
      </div>

      <div className={cn("items-center gap-2 px-4", isMobile ? "hidden" : "flex")}>
         <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-[25px]">
              <BarChart2 className="mr-2 h-4 w-4" />
              Compare models
            </Button>
            <CreatePersonaDialog />
         </div>
      </div>
    </header>
  );
}
