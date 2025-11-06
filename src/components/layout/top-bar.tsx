
'use client';

import { Button } from "../ui/button";
import { WandSparkles, BarChart2, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { CreatePersonaDialog } from "../personas/create-persona-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Logo } from "../icons/logo";

export function Topbar({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const tabs = [
    { name: "Chat Board", href: "/", icon: WandSparkles },
  ];

  return (
    <header className="flex items-center justify-between p-2 border-b h-[60px] bg-card shrink-0 z-20">
      <div className="flex items-center gap-4">
        {isMobile ? children : (
         <Link href="/" className="flex items-center gap-2 px-4">
              <Logo className="text-primary h-6 w-6"/>
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
                    pathname === tab.href ? "bg-secondary text-accent-foreground" : ""
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
            <Button variant="outline" className="rounded-[25px]" asChild>
              <Link href="/dashboard">
                <BarChart2 className="mr-2 h-4 w-4" />
                Compare models
              </Link>
            </Button>
            <CreatePersonaDialog />
         </div>
      </div>
    </header>
  );
}
