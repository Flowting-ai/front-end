
"use client";

import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { ModelSelector } from "../chat/model-selector";
import { WandSparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Topbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    { name: "Chat Board", href: "/", icon: WandSparkles },
    { name: "AI Automation", href: "/dashboard", icon: WandSparkles },
  ];
  return (
    <header className="flex items-center justify-between p-4 border-b h-[69px] bg-card">
      <nav className="flex items-center gap-4">
        {tabs.map((tab) => (
          <Button
            key={tab.name}
            variant="ghost"
            asChild
            className={cn(
                "font-semibold",
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
      <div className="flex items-center gap-4">
        {children}
        <ModelSelector />
        <div className="w-48">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Token count</span>
                <span className="text-xs text-muted-foreground">80%</span>
            </div>
            <Progress value={80} className="h-1.5" />
            <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-foreground">1.6M/2m</span>
            </div>
        </div>
      </div>
    </header>
  );
}
